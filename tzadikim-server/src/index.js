// Tzadikim Tombs remote MCP server (Streamable HTTP, stateless, JSON responses) on Cloudflare Workers.
// Privacy: request bodies and arguments are never logged. The only outbound request is a fetch of the
// app's public data feed (no user data), cached at the edge for an hour.
import { TOOLS, ToolError, LANGS } from './catalog.js';
import { PRIVACY_HTML } from './privacy.js';
import { LOGO_PNG_BASE64 } from './logo.js';

const FEED = 'https://tzadikim-tombs.web.app/tzadikim.json';
const FEED_TTL = 3600;
const LOGO_PNG = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
const SERVER_INFO = { name: 'Tzadikim Tombs', title: 'Tzadikim Tombs by KeyQuest', version: '0.1.0',
  icons: [{ src: 'https://tzadikim-mcp.forkflip-mcp.workers.dev/favicon.png', mimeType: 'image/png', sizes: ['128x128'] }] };
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'Tombs of tzadikim (Jewish sages) in Israel and abroad, from the Tzadikim Tombs app: 115 sites with ' +
  'locations, short bios, yahrzeit dates and navigation links. Read-only, no account. Pass the user\'s language (he, en, fr, ru). ' +
  'Keep the attribution and say when a location is by tradition.';
const MAX_BODY = 16 * 1024;
const MAX_BATCH = 10;

const lang = { type: 'string', enum: LANGS, description: 'Answer language: he (default), en, fr or ru' };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const TOOL_DEFS = [
  {
    name: 'search_tzadikim',
    title: 'Search tzadikim tombs',
    description: 'Find tombs of tzadikim by name, nickname or town, in Hebrew, English, French or Russian ' +
      '(e.g. "רבי שמעון בר יוחאי", "האר\\"י", "Baba Sali", "Uman", "צפת"). Returns ids for get_tzadik.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['query'], properties: {
      query: { type: 'string', minLength: 2, maxLength: 80, description: 'Name, nickname or town' },
      region: { type: 'string', description: 'Optional region id from list_regions (e.g. north, jerusalem, europe)' },
      limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Max results (default 8)' },
      language: lang } },
    annotations: { title: 'Search tzadikim tombs', ...RO },
  },
  {
    name: 'get_tzadik',
    title: 'Get tomb details',
    description: 'Full details for one site: who is buried there, short bio with source, yahrzeit (Hebrew date and next dates), ' +
      'how sure the location is, image with licence, and Google Maps / Waze / Apple Maps links.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: {
      id: { type: 'string', pattern: '^s\\d{3,4}$', description: 'Site id such as "s015"' },
      language: lang } },
    annotations: { title: 'Get tomb details', ...RO },
  },
  {
    name: 'find_nearby',
    title: 'Find tombs nearby',
    description: 'List tombs within a radius of a point (lat/lon) or of another site (near_id), nearest first. ' +
      'Good for planning a route or "what else is near Meron?".',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      lat: { type: 'number', minimum: -90, maximum: 90 },
      lon: { type: 'number', minimum: -180, maximum: 180 },
      near_id: { type: 'string', pattern: '^s\\d{3,4}$', description: 'Use this site as the centre instead of lat/lon' },
      radius_km: { type: 'number', exclusiveMinimum: 0, maximum: 500, description: 'Default 30' },
      limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Default 8' },
      language: lang } },
    annotations: { title: 'Find tombs nearby', ...RO },
  },
  {
    name: 'upcoming_yahrzeits',
    title: 'Upcoming yahrzeits (hilulot)',
    description: 'Yahrzeits (hilulot) of tzadikim in the coming days, with the site to visit. Only people with a known date.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      from_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Start date YYYY-MM-DD (default today)' },
      days: { type: 'integer', minimum: 1, maximum: 366, description: 'How many days ahead (default 30)' },
      language: lang } },
    annotations: { title: 'Upcoming yahrzeits', ...RO },
  },
  {
    name: 'list_regions',
    title: 'List regions',
    description: 'Regions covered (Israel by area, plus Europe, North Africa and the Americas) with site counts.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { language: lang } },
    annotations: { title: 'List regions', ...RO },
  },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Protocol-Version',
};
const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...SECURITY, ...extra } });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
const toolText = (id, out, isError = false) =>
  ({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }], isError } });

let memo = null; // per-isolate copy of the feed
export async function loadData(deps) {
  if (deps.data) return deps.data;
  if (memo && Date.now() - memo.at < FEED_TTL * 1000) return memo.data;
  const res = await deps.fetch(FEED, { cf: { cacheTtl: FEED_TTL, cacheEverything: true } });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.sites) || !data.sites.length) throw new Error('feed: no sites');
  memo = { at: Date.now(), data };
  return data;
}

export async function handle(msg, deps = {}) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  if (msg.id === undefined) return null;
  const { id, method, params = {} } = msg;
  switch (method) {
    case 'initialize': {
      const asked = params.protocolVersion;
      return { jsonrpc: '2.0', id, result: {
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS } };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOL_DEFS } };
    case 'tools/call': {
      const name = params.name;
      const fn = Object.hasOwn(TOOLS, name) ? TOOLS[name] : null;
      if (!fn) return rpcError(id, -32602, `Unknown tool: ${String(name).slice(0, 60)}`);
      const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
      try {
        const data = await loadData(deps);
        const today = deps.today || new Date().toISOString().slice(0, 10);
        return toolText(id, fn(data, args, today));
      } catch (e) {
        const message = e instanceof ToolError ? e.message : 'The tombs data is temporarily unavailable. Try again in a minute.';
        return toolText(id, `Error executing tool ${name}: ${message}`, true);
      }
    }
    default:
      return rpcError(id, -32601, 'Method not found');
  }
}

// Home page for browsers and favicon crawlers (Claude's directory shows the site icon); API clients still get JSON.
const HOME_DESC = 'Tombs of tzadikim in Israel and abroad: 115 sites with bios, yahrzeit dates and map links.';
const homeHtml = (origin) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SERVER_INFO.title}</title><meta name="description" content="${HOME_DESC}">
<link rel="icon" type="image/png" href="/favicon.png"><link rel="shortcut icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/favicon.png">
<meta property="og:title" content="${SERVER_INFO.title}"><meta property="og:description" content="${HOME_DESC}"><meta property="og:image" content="${origin}/favicon.png">
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#222;background:#fff}img{width:96px;height:96px;border-radius:20px}code{background:#f2f2f2;padding:2px 6px;border-radius:4px}@media(prefers-color-scheme:dark){body{color:#eee;background:#151515}code{background:#2a2a2a}a{color:#7cc4ff}}</style></head><body>
<img src="/favicon.png" alt="Tzadikim Tombs logo" width="96" height="96"><h1>${SERVER_INFO.title}</h1><p>${HOME_DESC}</p>
<p>A read-only MCP server for Claude. No account or sign-in. MCP endpoint: <code>${origin}/mcp</code></p>
<p><a href="/privacy">Privacy policy</a> · <a href="https://github.com/keyquest-studio/claude-plugins">Source and support</a> · <a href="https://1clicksoft.net">KeyQuest Studio</a></p>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
    if (url.pathname === '/' && request.method === 'GET') {
      if ((request.headers.get('accept') || '').includes('text/html')) {
        return new Response(homeHtml(url.origin), { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY, 'Cache-Control': 'public, max-age=3600' } });
      }
      return json({ name: SERVER_INFO.title, mcp_endpoint: `${url.origin}/mcp`, read_only: true, privacy: `${url.origin}/privacy`,
        install: 'claude plugin marketplace add keyquest-studio/claude-plugins', source: 'https://github.com/keyquest-studio/claude-plugins' });
    }
    if ((url.pathname === '/favicon.ico' || url.pathname === '/favicon.png') && request.method === 'GET') {
      return new Response(LOGO_PNG, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
    }
    if (url.pathname === '/privacy' && request.method === 'GET') {
      return new Response(PRIVACY_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', ...SECURITY, 'Cache-Control': 'public, max-age=3600' } });
    }
    if (url.pathname !== '/mcp') return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json(rpcError(null, -32000, 'Method not allowed: use POST'), 405, { Allow: 'POST, OPTIONS' });

    if (env.LIMITER) {
      const key = request.headers.get('cf-connecting-ip') || 'unknown';
      const { success } = await env.LIMITER.limit({ key });
      if (!success) return json(rpcError(null, -32000, 'Too many requests, slow down'), 429, { 'Retry-After': '60' });
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (length > MAX_BODY) return json(rpcError(null, -32600, 'Request too large'), 413);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json(rpcError(null, -32600, 'Request too large'), 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json(rpcError(null, -32700, 'Parse error'), 400); }

    const deps = { fetch: (u, i) => fetch(u, i) };
    const headers = { 'Mcp-Protocol-Version': PROTOCOLS[0] };
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > MAX_BATCH) return json(rpcError(null, -32600, 'Invalid batch'), 400);
      const out = (await Promise.all(body.map((m) => handle(m, deps)))).filter(Boolean);
      return out.length ? json(out, 200, headers) : new Response(null, { status: 202, headers: { ...CORS, ...SECURITY } });
    }
    const out = await handle(body, deps);
    return out ? json(out, 200, headers) : new Response(null, { status: 202, headers: { ...CORS, ...SECURITY } });
  },
};
