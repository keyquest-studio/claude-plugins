// Smart Shopping List remote MCP server (Streamable HTTP, stateless, JSON responses) on Cloudflare Workers.
// Privacy: request bodies and arguments are never logged. The only outbound request is the product
// search term, sent to the app's own price service; answers are cached at the edge by search term.
import { ToolError, normalizeQuery, normalizeLimit, fetchUpstream, fetchControlled, shape, listChains, CACHE_SECONDS } from './prices.js';
import { PRIVACY_HTML } from './privacy.js';
import { LOGO_PNG_BASE64 } from './logo.js';

const LOGO_PNG = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
const SERVER_INFO = { name: 'Smart Shopping List Prices', title: 'Smart Shopping List by KeyQuest', version: '0.1.0',
  icons: [{ src: 'https://smart-shopping-mcp.forkflip-mcp.workers.dev/favicon.png', mimeType: 'image/png', sizes: ['128x128'] }] };
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'Israeli supermarket price comparison from the Smart Shopping List (קנייה חכמה) app. ' +
  'All tools are read-only and need no account. Search in Hebrew for best results. ' +
  'Prices are a daily guide from the chains\' official files, not a guarantee of the shelf price.';
const MAX_BODY = 16 * 1024;
const MAX_BATCH = 10;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
export const TOOL_DEFS = [
  {
    name: 'compare_grocery_price',
    title: 'Compare Israeli grocery prices',
    description: 'Search Israeli supermarket prices by product name (Hebrew works best; partial names match) and ' +
      'compare the chains, cheapest first. Covers Shufersal, Victory, Rami Levy, Yochananof, Osher Ad, Tiv Taam and ' +
      'Carrefour, from each chain\'s official daily price-transparency file. Returns only products that have a price.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 2, maxLength: 60, description: 'Product name or part of it, e.g. "חלב תנובה 3%" or "לחם"' },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'How many products to return (default 5)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { title: 'Compare Israeli grocery prices', ...READ_ONLY },
  },
  {
    name: 'list_grocery_chains',
    title: 'List covered supermarket chains',
    description: 'List the Israeli supermarket chains covered by the price comparison, in Hebrew and English.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List covered supermarket chains', ...READ_ONLY, openWorldHint: false },
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

// Edge cache keyed by the normalized search term, so the same question within 6 hours costs no Firestore reads.
async function cachedUpstream(query, deps) {
  const cache = deps.cache;
  const key = new Request(`https://cache.smart-shopping.internal/q/${encodeURIComponent(query)}`);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }
  const data = await fetchUpstream(query, deps.fetch);
  if (cache) {
    const res = new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
    const put = cache.put(key, res);
    if (deps.waitUntil) deps.waitUntil(put); else await put;
  }
  return data;
}

export async function handle(msg, deps = {}) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  if (msg.id === undefined) return null; // notifications
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
      const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {};
      try {
        if (name === 'list_grocery_chains') return toolText(id, listChains());
        if (name === 'compare_grocery_price') {
          const query = normalizeQuery(args.query);
          const limit = normalizeLimit(args.limit);
          const [upstream, controlled] = await Promise.all([
            cachedUpstream(query, deps),
            fetchControlled(deps.fetch).catch(() => []), // optional extra: never fails the search
          ]);
          return toolText(id, shape(query, upstream, limit, controlled));
        }
        return rpcError(id, -32602, `Unknown tool: ${String(name).slice(0, 60)}`);
      } catch (e) {
        const message = e instanceof ToolError ? e.message : 'The price service is temporarily unavailable. Try again in a minute.';
        return toolText(id, `Error executing tool ${String(name).slice(0, 60)}: ${message}`, true);
      }
    }
    default:
      return rpcError(id, -32601, 'Method not found');
  }
}

// Home page for browsers and favicon crawlers (Claude's directory shows the site icon); API clients still get JSON.
const HOME_DESC = 'Compare Israeli supermarket prices across 7 chains from their official daily price files.';
const homeHtml = (origin) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SERVER_INFO.title}</title><meta name="description" content="${HOME_DESC}">
<link rel="icon" type="image/png" href="/favicon.png"><link rel="shortcut icon" href="/favicon.ico"><link rel="apple-touch-icon" href="/favicon.png">
<meta property="og:title" content="${SERVER_INFO.title}"><meta property="og:description" content="${HOME_DESC}"><meta property="og:image" content="${origin}/favicon.png">
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px;color:#222;background:#fff}img{width:96px;height:96px;border-radius:20px}code{background:#f2f2f2;padding:2px 6px;border-radius:4px}@media(prefers-color-scheme:dark){body{color:#eee;background:#151515}code{background:#2a2a2a}a{color:#7cc4ff}}</style></head><body>
<img src="/favicon.png" alt="Smart Shopping List logo" width="96" height="96"><h1>${SERVER_INFO.title}</h1><p>${HOME_DESC}</p>
<p>A read-only MCP server for Claude. No account or sign-in. MCP endpoint: <code>${origin}/mcp</code></p>
<p><a href="/privacy">Privacy policy</a> · <a href="https://github.com/keyquest-studio/claude-plugins">Source and support</a> · <a href="https://1clicksoft.net">KeyQuest Studio</a></p>
</body></html>`;

export default {
  async fetch(request, env, ctx) {
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

    const deps = { cache: globalThis.caches?.default, fetch: (u, i) => fetch(u, i), waitUntil: (p) => ctx.waitUntil(p) };
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
