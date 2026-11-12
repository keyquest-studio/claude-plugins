// Tool logic for the Smart Shopping List price plugin.
// Prices come from the app's own price service (a Firebase Cloud Function that reads the
// daily price-transparency feeds). This worker adds input limits, filtering and an edge cache,
// so repeated questions never reach Firestore.

export const UPSTREAM = 'https://europe-west1-shoppinglist-maor169.cloudfunctions.net/mcpGroceryPrices';
export const CHAINS = ['שופרסל', 'ויקטורי', 'רמי לוי', 'יוחננוף', 'אושר עד', 'טיב טעם', 'קרפור'];
export const CHAINS_EN = {
  'שופרסל': 'Shufersal', 'ויקטורי': 'Victory', 'רמי לוי': 'Rami Levy', 'יוחננוף': 'Yochananof',
  'אושר עד': 'Osher Ad', 'טיב טעם': 'Tiv Taam', 'קרפור': 'Carrefour',
};
export const NOTICE = 'Prices are from the chains\' official price-transparency files, refreshed daily. ' +
  'They are a guide: branch, club and promotion prices can differ from what is shown. Check the shelf price.';
const UPSTREAM_LIMIT = 20;
const MAX_QUERY = 60;
export const CACHE_SECONDS = 6 * 3600;

export class ToolError extends Error {}

export function normalizeQuery(q) {
  if (typeof q !== 'string') throw new ToolError('query must be a string');
  const clean = q.normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length < 2) throw new ToolError('query is too short: use at least 2 characters');
  if (clean.length > MAX_QUERY) throw new ToolError(`query is too long: use at most ${MAX_QUERY} characters`);
  return clean;
}

export function normalizeLimit(limit) {
  if (limit === undefined || limit === null) return 5;
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ToolError('limit must be a whole number from 1 to 10');
  return limit;
}

// Fetch every match (up to UPSTREAM_LIMIT) for one query from the app's price service.
export async function fetchUpstream(query, fetchImpl = fetch) {
  const res = await fetchImpl(UPSTREAM, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'compare_grocery_price', arguments: { query, limit: UPSTREAM_LIMIT } } }),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const raw = await res.text();
  // Streamable HTTP may answer as SSE ("data: {...}") or plain JSON.
  const line = raw.split('\n').find((l) => l.startsWith('data:'));
  const msg = JSON.parse(line ? line.slice(5) : raw);
  const text = msg?.result?.content?.[0]?.text;
  if (typeof text !== 'string') throw new Error('upstream: unexpected reply');
  if (!text.trim().startsWith('{')) return { matched_count: 0, results: [] }; // "No products matched ..."
  const data = JSON.parse(text);
  return { matched_count: Number(data.matched_count) || 0, results: Array.isArray(data.results) ? data.results : [] };
}

// Keep only products that have at least one valid price; cheapest first per product.
export function shape(query, upstream, limit) {
  const priced = [];
  for (const r of upstream.results) {
    const entries = Object.entries(r?.all_prices_ils || {})
      .filter(([chain, p]) => typeof chain === 'string' && typeof p === 'number' && Number.isFinite(p) && p > 0)
      .sort((a, b) => a[1] - b[1]);
    if (!entries.length || typeof r.product !== 'string') continue;
    priced.push({
      product: r.product,
      cheapest_chain: entries[0][0],
      cheapest_chain_en: CHAINS_EN[entries[0][0]] || null,
      cheapest_price_ils: entries[0][1],
      chains_with_price: entries.length,
      all_prices_ils: Object.fromEntries(entries),
      last_updated: typeof r.last_updated === 'string' ? r.last_updated : null,
    });
  }
  return {
    query,
    matched_products: upstream.matched_count,
    shown: Math.min(limit, priced.length),
    results: priced.slice(0, limit),
    tip: priced.length ? undefined : 'No priced product matched. Try a shorter, more generic Hebrew term (e.g. "חלב" rather than a brand and size).',
    notice: NOTICE,
    app: 'Smart Shopping List (קנייה חכמה): https://apps.apple.com/app/id6808103403 · https://play.google.com/store/apps/details?id=com.maor169.shoppinglist',
  };
}

export function listChains() {
  return {
    chains: CHAINS.map((he) => ({ name_he: he, name_en: CHAINS_EN[he] })),
    source: 'Each chain\'s official price-transparency feed (published under Israel\'s Food Law), refreshed daily.',
    notice: NOTICE,
  };
}
