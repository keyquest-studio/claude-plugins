import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, TOOL_DEFS } from '../src/index.js';
import { normalizeQuery, shape } from '../src/prices.js';

const upstreamReply = (results, matched = results.length) => ({
  ok: true, status: 200,
  text: async () => 'event: message\ndata: ' + JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text',
    text: JSON.stringify({ query: 'x', matched_count: matched, results }) }] } }) + '\n',
});
const call = (name, args, deps) => handle({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } }, deps);
const parse = (r) => JSON.parse(r.result.content[0].text);

test('initialize and tools/list', async () => {
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  const list = await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.deepEqual(list.result.tools.map((t) => t.name), ['compare_grocery_price', 'list_grocery_chains']);
  assert.ok(TOOL_DEFS.every((t) => t.annotations.readOnlyHint === true));
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('drops products without prices, sorts cheapest first, respects limit', async () => {
  let sent;
  const fetch = async (u, init) => { sent = JSON.parse(init.body); return upstreamReply([
    { product: 'no price', all_prices_ils: {} },
    { product: 'חלב 3%', all_prices_ils: { 'שופרסל': 7.9, 'רמי לוי': 6.4, 'bad': -1 }, last_updated: '2026-11-12T00:00:00Z' },
    { product: 'חלב 1%', all_prices_ils: { 'ויקטורי': 6.9 } },
  ], 40); };
  const out = parse(await call('compare_grocery_price', { query: '  חלב  ', limit: 1 }, { fetch }));
  assert.equal(sent.params.arguments.query, 'חלב');
  assert.equal(out.matched_products, 40);
  assert.equal(out.results.length, 1);
  assert.equal(out.results[0].cheapest_chain, 'רמי לוי');
  assert.equal(out.results[0].cheapest_chain_en, 'Rami Levy');
  assert.deepEqual(Object.keys(out.results[0].all_prices_ils), ['רמי לוי', 'שופרסל']);
  assert.match(out.notice, /shelf price/);
});

test('no match gives a tip, not an error', async () => {
  const fetch = async () => ({ ok: true, status: 200, text: async () => 'data: ' + JSON.stringify({ result: { content: [{ type: 'text', text: 'No products matched "zz".' }] } }) });
  const out = parse(await call('compare_grocery_price', { query: 'zzzz' }, { fetch }));
  assert.equal(out.results.length, 0);
  assert.ok(out.tip);
});

test('validates input before any network call', async () => {
  const fetch = async () => { throw new Error('must not be called'); };
  for (const args of [{ query: 'a' }, { query: 'x'.repeat(61) }, { query: 5 }, { query: 'חלב', limit: 0 }, { query: 'חלב', limit: 11 }, { query: 'חלב', limit: 2.5 }]) {
    const r = await call('compare_grocery_price', args, { fetch });
    assert.equal(r.result.isError, true, JSON.stringify(args));
  }
});

test('upstream failure is a friendly tool error', async () => {
  const r = await call('compare_grocery_price', { query: 'חלב' }, { fetch: async () => ({ ok: false, status: 500, text: async () => '' }) });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /temporarily unavailable/);
});

test('cache: second identical search does not hit upstream', async () => {
  const store = new Map();
  const cache = { match: async (k) => store.get(k.url)?.clone(), put: async (k, v) => { store.set(k.url, v); } };
  let n = 0;
  const fetch = async () => { n++; return upstreamReply([{ product: 'לחם', all_prices_ils: { 'שופרסל': 9 } }]); };
  await call('compare_grocery_price', { query: 'לחם' }, { fetch, cache });
  const out = parse(await call('compare_grocery_price', { query: 'לחם', limit: 3 }, { fetch, cache }));
  assert.equal(n, 1);
  assert.equal(out.results[0].product, 'לחם');
});

test('chains list, unknown tool and bad requests', async () => {
  const chains = parse(await call('list_grocery_chains', {}));
  assert.equal(chains.chains.length, 7);
  assert.equal((await call('nope', {})).error.code, -32602);
  assert.equal((await handle({ id: 1 })).error.code, -32600);
  assert.equal((await handle({ jsonrpc: '2.0', id: 1, method: 'x' })).error.code, -32601);
  assert.equal(normalizeQuery('a\u0000b  c'), 'a b c');
  assert.equal(shape('q', { matched_count: 0, results: [] }, 5).results.length, 0);
});
