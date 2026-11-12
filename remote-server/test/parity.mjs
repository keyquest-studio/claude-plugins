// Compares a running server (local `wrangler dev` or the deployed URL) with the Python outputs.
// Usage: node test/parity.mjs <mcp url> <cases.json> <expected.json>
import { readFileSync } from 'node:fs';

const [url, casesPath, expectedPath] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
let id = 0;
async function rpc(method, params) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  return r.json();
}

let failures = 0;
const init = await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'parity', version: '1' } });
console.log('initialize:', init.result.serverInfo.name, init.result.protocolVersion);
const tools = await rpc('tools/list', {});
console.log('tools:', tools.result.tools.map((t) => t.name).join(', '));

for (let i = 0; i < cases.length; i++) {
  const [name, args] = cases[i];
  const res = (await rpc('tools/call', { name, arguments: args })).result;
  const exp = expected[i];
  let ok;
  if (exp.error) ok = res.isError === true;
  else if (res.isError) ok = false;
  else {
    const got = JSON.parse(res.content[0].text);
    if (name === 'suggest_meals') ok = got.total_matches === exp.ok.total_matches;
    else ok = JSON.stringify(got) === JSON.stringify(exp.ok);
  }
  if (!ok) { failures++; console.log('MISMATCH', i, name, JSON.stringify(args), '\n  got:', res.content[0].text.slice(0, 300)); }
}
// suggest_meals: random, so check totals and that results really match the filter
for (const args of [{ meal: 'dinner', max_minutes: 30, language: 'he' }, { diet: 'keto' }, { cuisine: 'thai', kosher_only: true }]) {
  const res = JSON.parse((await rpc('tools/call', { name: 'suggest_meals', arguments: args })).result.content[0].text);
  const bad = res.recipes.some((r) => (args.max_minutes && r.prepMinutes > args.max_minutes) || (args.diet && !r.diets.includes(args.diet)) ||
    (args.cuisine && r.cuisine !== args.cuisine) || (args.kosher_only && !r.kosherFriendly) || (args.meal && !r.meals.includes(args.meal)));
  if (bad || res.recipes.length > 3) { failures++; console.log('suggest_meals filter broken', JSON.stringify(args)); }
}
const unknown = await rpc('tools/call', { name: 'delete_everything', arguments: {} });
if (!unknown.error) { failures++; console.log('unknown tool not rejected'); }
console.log(failures ? `FAILED: ${failures}` : `PASS: ${cases.length} cases + suggest + unknown-tool`);
process.exit(failures ? 1 : 0);
