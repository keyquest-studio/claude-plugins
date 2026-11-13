import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker, { handle, TOOL_DEFS, loadData } from '../src/index.js';
import { norm, haversineKm } from '../src/catalog.js';

const data = JSON.parse(readFileSync(new URL('./fixture.json', import.meta.url)));
const deps = { data, today: '2026-11-12' };
const call = async (name, args) => handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, deps);
const out = async (name, args) => { const r = await call(name, args); assert.equal(r.result.isError, false, r.result.content[0].text); return JSON.parse(r.result.content[0].text); };
const err = async (name, args) => { const r = await call(name, args); assert.equal(r.result.isError, true, JSON.stringify(args)); return r.result.content[0].text; };

test('tools/list has 5 read-only tools', async () => {
  const r = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.deepEqual(r.result.tools.map((t) => t.name), ['search_tzadikim', 'get_tzadik', 'find_nearby', 'upcoming_yahrzeits', 'list_regions']);
  assert.ok(TOOL_DEFS.every((t) => t.annotations.readOnlyHint));
});

test('search: Hebrew with title, English, nickname, city, niqqud', async () => {
  assert.equal((await out('search_tzadikim', { query: 'רבי שמעון בר יוחאי' })).results[0].id, 's015');
  assert.equal((await out('search_tzadikim', { query: 'Shimon bar Yochai', language: 'en' })).results[0].name, 'Shimon bar Yochai');
  assert.equal((await out('search_tzadikim', { query: 'האר"י' })).results[0].id, 's019');
  assert.equal((await out('search_tzadikim', { query: 'Rebbe Nachman' })).results[0].id, 's089');
  assert.equal((await out('search_tzadikim', { query: 'Shimon bar Yoch' })).results[0].id, 's015');
  assert.ok((await out('search_tzadikim', { query: 'עמוקה' })).results.some((r) => r.id === 's005'));
  assert.equal(norm('שִׁמְעוֹן'), norm('שמעון')); assert.equal(norm('רמב"ם'), norm('רמבם'));
  assert.equal((await out('search_tzadikim', { query: 'Ari' })).results[0].id, 's019');
  await err('search_tzadikim', { query: 'רבי' });
  const none = await out('search_tzadikim', { query: 'zzzzzz' });
  assert.equal(none.results.length, 0); assert.ok(none.tip);
  assert.ok((await out('search_tzadikim', { query: 'נחמן', region: 'europe' })).results.every((r) => r.region === 'europe'));
});

test('get_tzadik: bio, yahrzeit, nav, attribution, Judea flag', async () => {
  const s = await out('get_tzadik', { id: 's015' });
  assert.equal(s.people[0].yahrzeit.hebrew_date, '18 אייר');
  assert.ok(s.people[0].yahrzeit.next_dates.every((d) => d >= '2026-11-12'));
  assert.ok(s.people[0].bio.source.startsWith('https://'));
  assert.match(s.navigation.waze, /^https:\/\/waze\.com\/ul\?ll=/);
  assert.match(s.attribution, /OpenStreetMap/);
  assert.equal((await out('get_tzadik', { id: 's015', language: 'en' })).people[0].yahrzeit.hebrew_date, '18 Iyar');
  assert.equal((await out('get_tzadik', { id: 's055' })).in_judea_and_samaria, true);
  await err('get_tzadik', { id: 's999' });
  await err('get_tzadik', { id: 's015', language: 'de' });
});

test('find_nearby by id and by coordinates', async () => {
  const n = await out('find_nearby', { near_id: 's015', radius_km: 20 });
  assert.ok(n.results.length > 0 && n.results.every((r) => r.id !== 's015'));
  assert.ok(n.results.every((r, i, a) => i === 0 || a[i - 1].distance_km <= r.distance_km));
  const uman = await out('find_nearby', { lat: 48.75, lon: 30.22, radius_km: 50, language: 'en' });
  assert.equal(uman.results[0].id, 's089');
  await err('find_nearby', {});
  await err('find_nearby', { lat: 32, lon: 35, radius_km: 9999 });
  assert.ok(Math.abs(haversineKm(31.778, 35.235, 32.08, 34.78) - 53.6) < 2);
});

test('upcoming_yahrzeits window', async () => {
  const y = await out('upcoming_yahrzeits', { from_date: '2027-05-01', days: 60 });
  assert.ok(y.results.some((r) => r.id === 's015' && r.date === '2027-05-25'));
  assert.ok(y.results.every((r, i, a) => i === 0 || a[i - 1].date <= r.date));
  await err('upcoming_yahrzeits', { from_date: '12/05/2027' });
  await err('upcoming_yahrzeits', { days: 0 });
});

test('regions, errors and feed loading', async () => {
  const r = await out('list_regions', { language: 'en' });
  assert.equal(r.total_sites, data.sites.length);
  assert.equal((await call('nope', {})).error.code, -32602);
  await err('search_tzadikim', { query: 'a' });
  await err('search_tzadikim', { query: 'רבי', region: 'mars' });
  const bad = await handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_regions', arguments: {} } },
    { fetch: async () => ({ ok: false, status: 503 }) });
  assert.match(bad.result.content[0].text, /temporarily unavailable/);
  let n = 0;
  const f = async () => { n++; return { ok: true, json: async () => data }; };
  await loadData({ fetch: f }); await loadData({ fetch: f });
  assert.equal(n, 1);
});

test('favicon is served as PNG and advertised in serverInfo.icons', async () => {
  for (const path of ['/favicon.ico', '/favicon.png']) {
    const res = await worker.fetch(new Request(`https://example.dev${path}`), {});
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...bytes.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  }
  const init = await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } }, {});
  assert.match(init.result.serverInfo.icons[0].src, /^https:\/\/.+\/favicon\.png$/);
});

test('home page: HTML with icon links for browsers, JSON for API clients', async () => {
  const html = await worker.fetch(new Request('https://example.dev/', { headers: { Accept: 'text/html,application/xhtml+xml' } }), {});
  assert.match(html.headers.get('content-type'), /text\/html/);
  const body = await html.text();
  assert.match(body, /<link rel="icon" type="image\/png" href="\/favicon.png">/);
  assert.match(body, /https:\/\/example.dev\/mcp/);
  const api = await worker.fetch(new Request('https://example.dev/'), {});
  assert.match(api.headers.get('content-type'), /application\/json/);
  assert.equal((await api.json()).mcp_endpoint, 'https://example.dev/mcp');
});
