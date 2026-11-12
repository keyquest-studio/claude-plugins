// ForkFlip remote MCP server (Streamable HTTP, stateless, JSON responses) on Cloudflare Workers.
// Privacy: request bodies and arguments are never logged or stored. No outbound requests.
import { TOOLS, ToolError } from './catalog.js';
import TOOL_DEFS from './tools.json';
import { PRIVACY_HTML } from './privacy.js';
import { LOGO_PNG_BASE64 } from './logo.js';

const LOGO_PNG = Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0));
const SERVER_INFO = { name: 'ForkFlip Recipe Catalog', title: 'ForkFlip by KeyQuest Studio', version: '0.2.0',
  icons: [{ src: 'https://forkflip-mcp.forkflip-mcp.workers.dev/favicon.png', mimeType: 'image/png', sizes: ['192x192'] }] };
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const INSTRUCTIONS = 'ForkFlip recipe catalog (163 original recipes, 7 languages). All tools are read-only. ' +
  'Pass the user\'s language code. Labels are informational, not allergy or kashrut certification.';
const MAX_BODY = 64 * 1024;
const MAX_BATCH = 20;

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

function handle(msg) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return rpcError(msg?.id, -32600, 'Invalid Request');
  }
  const isNotification = msg.id === undefined;
  if (isNotification) return null; // notifications/initialized, cancelled, etc.
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
        const out = fn(args);
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }], isError: false } };
      } catch (e) {
        const message = e instanceof ToolError ? e.message : 'Internal error';
        return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error executing tool ${name}: ${message}` }], isError: true } };
      }
    }
    default:
      return rpcError(id, -32601, 'Method not found');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });

    if (url.pathname === '/' && request.method === 'GET') {
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

    // Rate limit per client address. Exceeding it returns 429; it never creates a bill on the free plan.
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

    const headers = { 'Mcp-Protocol-Version': PROTOCOLS[0] };
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > MAX_BATCH) return json(rpcError(null, -32600, 'Invalid batch'), 400);
      const out = body.map(handle).filter(Boolean);
      return out.length ? json(out, 200, headers) : new Response(null, { status: 202, headers: { ...CORS, ...SECURITY } });
    }
    const out = handle(body);
    return out ? json(out, 200, headers) : new Response(null, { status: 202, headers: { ...CORS, ...SECURITY } });
  },
};
