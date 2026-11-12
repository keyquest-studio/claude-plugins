// Tool logic for the Tzadikim Tombs plugin. Pure functions over the app's published data feed
// (https://tzadikim-tombs.web.app/tzadikim.json), so they can be unit-tested without a network.

export class ToolError extends Error {}

export const LANGS = ['he', 'en', 'fr', 'ru'];
const MONTHS = {
  he: ['ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול', 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'],
  en: ['Nisan', 'Iyar', 'Sivan', 'Tammuz', 'Av', 'Elul', 'Tishrei', 'Cheshvan', 'Kislev', 'Tevet', 'Shevat', 'Adar', 'Adar II'],
  fr: ['Nissan', 'Iyar', 'Sivan', 'Tamouz', 'Av', 'Eloul', 'Tichri', 'Hechvan', 'Kislev', 'Tevet', 'Chevat', 'Adar', 'Adar II'],
  ru: ['Нисан', 'Ияр', 'Сиван', 'Таммуз', 'Ав', 'Элул', 'Тишрей', 'Хешван', 'Кислев', 'Тевет', 'Шват', 'Адар', 'Адар II'],
};
const PRECISION = {
  exact: 'Exact location of the tomb.',
  cemetery: 'Located inside the cemetery; the exact grave position is not given.',
};
const VERIFICATION = {
  multi_source: 'Location confirmed by several independent sources.',
  community_verified: 'Location verified by the community / curated list.',
  single_source: 'Location from a single source (OpenStreetMap or Wikidata).',
  cemetery_level: 'Known at cemetery level only.',
};
export const ATTRIBUTION = 'Data: Tzadikim Tombs app by KeyQuest Studio. Locations and names © OpenStreetMap contributors (ODbL); ' +
  'facts from Wikidata (CC0); bio excerpts from Wikipedia (CC BY-SA 4.0, some translated by AI); images from Wikimedia Commons (author and licence per image).';
export const NOTICE = 'Locations marked "by tradition" follow a tradition, not proven burial. ' +
  'Before visiting, check opening hours, dress code and, in Judea and Samaria, current access and security instructions.';
export const APP_URL = 'https://apps.apple.com/il/app/tzadikim-tombs/id6815972609';

const STOP = new Set(['רבי', 'רב', 'הרב', 'הרבי', 'רבינו', 'רבנו', 'קבר', 'קברי', 'ציון', 'צדיק', 'הצדיק', 'של', 'זצל', 'זיעא', 'הקדוש', 'אמנו', 'אבינו', 'הנביא',
  'imeinu', 'avinu', 'rabbi', 'rav', 'reb', 'rebbe', 'the', 'of', 'tomb', 'grave', 'kever', 'tzadik', 'tsadik', 'rabbin', 'tombe', 'de', 'du', 'la', 'le',
  'рабби', 'рав', 'могила', 'ребе']);
// Common nicknames the data spells differently.
const ALIASES = {
  rambam: 'maimonides', ramban: 'nahmanides', 'ари': 'luria', ari: 'luria', arizal: 'luria', 'האריזל': 'הארי', rashbi: 'shimon bar yochai',
  'רשבי': 'שמעון בר יוחאי', 'ramchal': 'luzzatto', 'רמחל': 'לוצאטו', 'baba sali': 'באבא סאלי', 'בבא סאלי': 'באבא סאלי',
  'מאיר בעל הנס': 'רבי מאיר', 'meir baal haness': 'rabbi meir', 'meir baal hanes': 'rabbi meir',
};
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const isHeb = (t) => /[\u05d0-\u05ea]/.test(t);

export function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[\u0591-\u05C7]/g, '') // Hebrew niqqud and cantillation
    .replace(/[\u0300-\u036f]/g, '') // Latin accents
    .toLowerCase()
    .replace(/[״"׳'`’‘]/g, '') // quote marks inside acronyms: רמב"ם -> רמבם
    .replace(/[\-–—·.,;:()\[\]/\\!?|]/g, ' ')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/\s+/g, ' ').trim();
}
// Spelling-insensitive form of a Hebrew word: drop the vowel letters א, ו, י after the first letter (באבא ~ בבא).
const skeleton = (t) => {
  if (!isHeb(t)) return t;
  const k = t[0] + t.slice(1).replace(/[אוי]/g, '');
  return k.length >= 3 ? k : t;
};
// Forms a word can match: itself, its skeleton, and without a one-letter Hebrew prefix (מליובאוויטש -> ליובאוויטש).
function forms(t) {
  const out = new Set([t, skeleton(t)]);
  if (isHeb(t) && t.length > 4 && 'הומבלכש'.includes(t[0])) { out.add(t.slice(1)); out.add(skeleton(t.slice(1))); }
  return out;
}
function queryTokens(q) {
  let text = norm(q);
  const alias = ALIASES[text] || ALIASES[text.replace(/^(רבי|rabbi|רב) /, '')];
  if (alias) text = norm(alias);
  return text.split(' ').filter((t) => t && !STOP.has(t));
}
function siteWords(site) {
  const parts = [];
  for (const v of Object.values(site.names || {})) parts.push(v);
  for (const v of Object.values(site.city || {})) parts.push(v);
  for (const p of site.persons || []) {
    for (const v of Object.values(p.names || {})) parts.push(v);
    for (const b of Object.values(p.bio || {})) if (b?.title) parts.push(b.title);
  }
  const words = new Set();
  for (const w of norm(parts.join(' ')).split(' ')) if (w) for (const f of forms(w)) words.add(f);
  return words;
}
const indexCache = new WeakMap();
function index(data) {
  let ix = indexCache.get(data);
  if (!ix) {
    const words = data.sites.map(siteWords);
    const df = new Map();
    for (const ws of words) for (const w of ws) df.set(w, (df.get(w) || 0) + 1);
    ix = { words, df, n: data.sites.length };
    indexCache.set(data, ix);
  }
  return ix;
}
// Returns [matched word, strength]: 1 for a whole-word match, 0.7 for a prefix ("Yochan" -> "yochanan").
function tokenHit(t, ws) {
  for (const f of forms(t)) if (ws.has(f)) return [f, 1];
  if (t.length >= 4) for (const w of ws) if (w.startsWith(t)) return [w, 0.7];
  return [null, 0];
}

export function pickLang(lang) {
  if (lang === undefined || lang === null) return 'he';
  if (!LANGS.includes(lang)) throw new ToolError(`language must be one of ${LANGS.join(', ')}`);
  return lang;
}
const pick = (obj, lang) => (obj && (obj[lang] || obj.en || obj.he)) || null;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(lat2 - lat1), dLon = r(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function yahrzeit(person, lang, today) {
  const d = person.death;
  if (!d?.heb?.d || !d?.heb?.m) return null;
  const month = MONTHS[lang][d.heb.m - 1] || null;
  const next = (d.next || []).filter((x) => x >= today).slice(0, 3);
  return {
    hebrew_date: month ? `${d.heb.d} ${month}` : null,
    by_tradition: !!d.tradition,
    next_dates: next,
    note: 'Dates are the evening-to-evening Hebrew date mapped to the civil date it falls on; the yahrzeit starts the evening before.',
  };
}

function summary(site, lang, extra = {}) {
  return {
    id: site.id,
    name: pick(site.names, lang),
    kind: site.kind,
    city: pick(site.city, lang),
    region: site.region,
    by_tradition: !!site.traditional,
    ...extra,
  };
}

export function navLinks(site) {
  const q = site.nav_query ? encodeURIComponent(site.nav_query) : `${site.lat},${site.lon}`;
  return {
    google_maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    waze: `https://waze.com/ul?ll=${site.lat},${site.lon}&navigate=yes`,
    apple_maps: `https://maps.apple.com/?ll=${site.lat},${site.lon}&q=${encodeURIComponent(site.names?.en || 'Tomb')}`,
  };
}

function checkRegion(data, region) {
  if (region === undefined || region === null) return null;
  if (!Object.hasOwn(data.regions || {}, region)) throw new ToolError(`unknown region; use one of: ${Object.keys(data.regions || {}).join(', ')}`);
  return region;
}
function checkLimit(limit, def, max) {
  if (limit === undefined || limit === null) return def;
  if (!Number.isInteger(limit) || limit < 1 || limit > max) throw new ToolError(`limit must be a whole number from 1 to ${max}`);
  return limit;
}

export function searchTzadikim(data, args) {
  const lang = pickLang(args.language);
  const region = checkRegion(data, args.region);
  const limit = checkLimit(args.limit, 8, 25);
  if (typeof args.query !== 'string' || args.query.trim().length < 2 || args.query.length > 80) {
    throw new ToolError('query must be 2-80 characters: a name, a nickname or a city');
  }
  const q = queryTokens(args.query);
  if (!q.length) throw new ToolError('add a name or town, not only a title like "רבי" or "Rabbi"');
  const ix = index(data);
  const weight = (w) => Math.log(1 + ix.n / (ix.df.get(w) || 1));
  const scored = [];
  data.sites.forEach((site, i) => {
    if (region && site.region !== region) return;
    let total = 0, got = 0;
    for (const t of q) {
      const [hit, strength] = tokenHit(t, ix.words[i]);
      const w = weight(hit || skeleton(t));
      total += w;
      got += w * strength;
    }
    const ratio = total ? got / total : 0;
    const exact = Object.values(site.names || {}).some((n) => queryTokens(n).join(' ') === q.join(' ')) ? 5 : 0;
    if (ratio >= (q.length === 1 ? 0.7 : 0.6)) scored.push([ratio * 10 + got + exact, site]);
  });
  scored.sort((a, b) => b[0] - a[0] || a[1].id.localeCompare(b[1].id));
  const results = scored.slice(0, limit).map(([, s]) => summary(s, lang, {
    people: (s.persons || []).map((p) => pick(p.names, lang)).filter(Boolean),
  }));
  return {
    query: args.query, total_matches: scored.length, results,
    tip: results.length ? undefined : 'No match. Try another spelling, a shorter name (e.g. "בבא סאלי", "Ari", "Uman") or a city.',
    attribution: ATTRIBUTION,
  };
}

export function getTzadik(data, args, today) {
  const lang = pickLang(args.language);
  const site = data.sites.find((s) => s.id === args.id);
  if (!site) throw new ToolError('unknown id; get ids from search_tzadikim, find_nearby or upcoming_yahrzeits');
  const people = (site.persons || []).map((p) => {
    const bio = pick(p.bio, lang);
    return {
      name: pick(p.names, lang),
      description: pick(p.desc, lang) || p.desc_en || null,
      bio: bio ? { text: bio.text, source: bio.url, translated_by_ai: !!bio.translated_from, licence: 'CC BY-SA 4.0 (Wikipedia)' } : null,
      yahrzeit: yahrzeit(p, lang, today),
    };
  });
  return {
    ...summary(site, lang),
    region_name: pick(data.regions?.[site.region], lang),
    coordinates: { lat: site.lat, lon: site.lon },
    km_from_town_centre: site.city_km ?? null,
    location_precision: PRECISION[site.precision] || site.precision,
    location_verification: VERIFICATION[site.verification] || site.verification,
    in_judea_and_samaria: !!site.westbank,
    opening_hours: site.opening_hours || 'not verified: check locally',
    people,
    image: site.image ? { url: site.image.url, author: site.image.author, licence: site.image.license, licence_url: site.image.license_url, page: site.image.page } : null,
    navigation: navLinks(site),
    notice: NOTICE,
    attribution: ATTRIBUTION,
    app: APP_URL,
  };
}

export function findNearby(data, args) {
  const lang = pickLang(args.language);
  const limit = checkLimit(args.limit, 8, 25);
  let lat = args.lat, lon = args.lon, origin = 'coordinates';
  if (args.near_id !== undefined) {
    const s = data.sites.find((x) => x.id === args.near_id);
    if (!s) throw new ToolError('unknown near_id');
    lat = s.lat; lon = s.lon; origin = pick(s.names, lang);
  }
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new ToolError('give lat and lon (decimal degrees) or near_id');
  }
  let radius = args.radius_km ?? 30;
  if (typeof radius !== 'number' || !(radius > 0) || radius > 500) throw new ToolError('radius_km must be from 0 to 500');
  const list = data.sites
    .filter((s) => s.id !== args.near_id)
    .map((s) => [haversineKm(lat, lon, s.lat, s.lon), s])
    .filter(([d]) => d <= radius)
    .sort((a, b) => a[0] - b[0]);
  return {
    origin, radius_km: radius, total: list.length,
    results: list.slice(0, limit).map(([d, s]) => summary(s, lang, { distance_km: Math.round(d * 10) / 10 })),
    note: 'Straight-line distance, not driving distance.',
    attribution: ATTRIBUTION,
  };
}

export function upcomingYahrzeits(data, args, today) {
  const lang = pickLang(args.language);
  const days = args.days ?? 30;
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new ToolError('days must be a whole number from 1 to 366');
  const from = args.from_date ?? today;
  if (typeof from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(from) || Number.isNaN(Date.parse(from))) throw new ToolError('from_date must be YYYY-MM-DD');
  const to = new Date(Date.parse(from) + days * 86400000).toISOString().slice(0, 10);
  const events = [];
  for (const s of data.sites) {
    for (const p of s.persons || []) {
      const y = yahrzeit(p, lang, from);
      const date = (p.death?.next || []).find((x) => x >= from && x <= to);
      if (y && date) events.push({ date, person: pick(p.names, lang), hebrew_date: y.hebrew_date, by_tradition: y.by_tradition, ...summary(s, lang) });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return {
    from_date: from, to_date: to, total: events.length, results: events.slice(0, 40),
    note: 'Only people with a known yahrzeit are listed. The yahrzeit starts the evening before the date shown.',
    attribution: ATTRIBUTION,
  };
}

export function listRegions(data, args) {
  const lang = pickLang(args.language);
  const counts = {};
  for (const s of data.sites) counts[s.region] = (counts[s.region] || 0) + 1;
  return {
    data_version: data.version,
    total_sites: data.sites.length,
    regions: Object.entries(data.regions || {}).map(([id, names]) => ({ id, name: pick(names, lang), sites: counts[id] || 0 })),
    attribution: ATTRIBUTION,
  };
}

export const TOOLS = {
  search_tzadikim: searchTzadikim,
  get_tzadik: getTzadik,
  find_nearby: findNearby,
  upcoming_yahrzeits: upcomingYahrzeits,
  list_regions: listRegions,
};
