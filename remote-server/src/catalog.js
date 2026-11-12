// ForkFlip read-only recipe catalog. Port of plugin-mcp/server.py (same tools, inputs and outputs).
// No accounts, no storage, no outbound requests.
import base from '../../plugins/forkflip/server/data/recipes.json';
import ru from '../../plugins/forkflip/server/data/recipes.ru.json';
import ar from '../../plugins/forkflip/server/data/recipes.ar.json';
import fr from '../../plugins/forkflip/server/data/recipes.fr.json';
import de from '../../plugins/forkflip/server/data/recipes.de.json';
import es from '../../plugins/forkflip/server/data/recipes.es.json';

export const LANGUAGES = ['he', 'en', 'ru', 'ar', 'fr', 'de', 'es'];
export const MEALS = ['breakfast', 'lunch', 'dinner', 'dessert'];
export const DIETS = ['meat', 'dairy', 'vegetarian', 'vegan', 'keto'];
export const CUISINES = ['mediterranean', 'middleEastern', 'italian', 'asian', 'thai', 'mexican', 'indian', 'american', 'french'];
export const NOTICE = 'Recipe labels are informational, not allergy guarantees or kosher certification. ' +
  'Check every ingredient, preparation and supervision. Ingredient matching is approximate; review quantities and missing items.';

export class ToolError extends Error {}

function loadCatalog() {
  const recipes = structuredClone(base);
  const tables = { ru, ar, fr, de, es };
  for (const lang of LANGUAGES.slice(2)) {
    const table = tables[lang];
    for (const r of recipes) {
      const t = table[r.id];
      if (!t) continue;
      r.name[lang] = t.name;
      r.instructions[lang] = t.instructions;
      const n = Math.min(r.ingredients.length, t.ingredients.length); // Python zip()
      for (let i = 0; i < n; i++) r.ingredients[i][lang] = t.ingredients[i];
    }
  }
  return recipes;
}

export const CATALOG = loadCatalog();
const BY_ID = new Map(CATALOG.map((r) => [r.id, r]));
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const localized = (value, language) => value[language] || value.en || '';

function project(r, language, full = false) {
  const out = { id: r.id, name: localized(r.name, language), meals: r.meals, diets: r.diets,
    cuisine: r.cuisine, prepMinutes: r.prepMinutes, kosherFriendly: r.kosher === true };
  if (full) {
    out.ingredients = r.ingredients.map((i) => localized(i, language));
    out.instructions = localized(r.instructions, language);
    out.notice = NOTICE;
  }
  return out;
}

function filtered({ meal = null, diet = null, kosher_only = false, max_minutes = null, cuisine = null } = {}) {
  return CATALOG.filter((r) => (meal === null || r.meals.includes(meal)) &&
    (diet === null || r.diets.includes(diet)) && (!kosher_only || r.kosher === true) &&
    (max_minutes === null || r.prepMinutes <= max_minutes) && (cuisine === null || r.cuisine === cuisine));
}

// Python: set(re.findall(r'[^\W\d_]+', unicodedata.normalize('NFKC', s).casefold()))
export function tokens(s) {
  const n = s.normalize('NFKC').toLowerCase().replace(/ß/g, 'ss').replace(/ς/g, 'σ');
  return new Set(n.match(/[\p{L}\p{Nl}\p{No}]+/gu) || []);
}

const subset = (a, b) => { for (const x of a) if (!b.has(x)) return false; return true; };

function covered(ingredient, pantry) {
  const variants = Object.values(ingredient).map(tokens);
  return pantry.some((words) => words.size > 0 && variants.some((v) => subset(words, v)));
}

const codepoints = (s) => [...s].length;

function randomSample(items, k) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1); crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

// ---------- argument validation (mirrors the pydantic schema) ----------
function opt(args, key, def) { return args[key] === undefined ? def : args[key]; }
function oneOf(value, allowed, label, nullable = true) {
  if (value === null && nullable) return null;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new ToolError(`Invalid ${label}`);
  return value;
}
function int(value, label, nullable = false) {
  if (value === null && nullable) return null;
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new ToolError(`Invalid ${label}`);
  return value;
}
function bool(value, label) {
  if (typeof value !== 'boolean') throw new ToolError(`Invalid ${label}`);
  return value;
}
function strList(value, label) {
  if (!Array.isArray(value) || value.some((s) => typeof s !== 'string')) throw new ToolError(`Invalid ${label}`);
  return value;
}
function filters(args, withMeal = true) {
  const f = {
    meal: withMeal ? oneOf(opt(args, 'meal', null), MEALS, 'meal') : null,
    diet: oneOf(opt(args, 'diet', null), DIETS, 'diet'),
    kosher_only: bool(opt(args, 'kosher_only', false), 'kosher_only'),
    max_minutes: int(opt(args, 'max_minutes', null), 'maximum time', true),
    cuisine: oneOf(opt(args, 'cuisine', null), CUISINES, 'cuisine'),
  };
  if (f.max_minutes !== null && !(f.max_minutes >= 1 && f.max_minutes <= 1440)) throw new ToolError('Invalid maximum time');
  return f;
}
const lang = (args) => oneOf(opt(args, 'language', 'en'), LANGUAGES, 'language', false);

// ---------- tools ----------
export const TOOLS = {
  list_recipes(args) {
    const language = lang(args);
    const offset = int(opt(args, 'offset', 0), 'pagination');
    const limit = int(opt(args, 'limit', 10), 'pagination');
    if (!(offset >= 0 && offset <= 10000) || !(limit >= 1 && limit <= 25)) throw new ToolError('Invalid pagination');
    const results = filtered(filters(args));
    return { total: results.length, offset, recipes: results.slice(offset, offset + limit).map((r) => project(r, language)), notice: NOTICE };
  },

  get_recipe(args) {
    const language = lang(args);
    const id = args.recipe_id;
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new ToolError('Invalid recipe ID');
    const recipe = BY_ID.get(id);
    if (!recipe) return { error: 'Recipe not found' };
    return project(recipe, language, true);
  },

  suggest_meals(args) {
    const language = lang(args);
    const options = filtered(filters(args));
    return { total_matches: options.length, recipes: randomSample(options, Math.min(3, options.length)).map((r) => project(r, language)), notice: NOTICE };
  },

  match_pantry(args) {
    const language = lang(args);
    const ingredients = args.ingredients;
    if (!Array.isArray(ingredients) || ingredients.length < 1 || ingredients.length > 30 ||
        ingredients.some((s) => typeof s !== 'string' || !s.trim() || codepoints(s) > 80)) {
      throw new ToolError('Supply 1–30 nonempty ingredient names, each at most 80 characters');
    }
    const pantry = ingredients.map(tokens);
    if (pantry.some((x) => x.size === 0)) throw new ToolError('Each ingredient must contain letters');
    const meal = oneOf(opt(args, 'meal', null), MEALS, 'meal');
    const matches = [];
    for (const r of filtered({ meal })) {
      const have = r.ingredients.map((i) => covered(i, pantry));
      const count = have.filter(Boolean).length;
      if (count) matches.push([count, r, have]);
    }
    matches.sort((a, b) => b[0] - a[0]); // stable, like Python
    return { recipes: matches.slice(0, 10).map(([count, r, flags]) => ({ ...project(r, language), matched_count: count,
      possibly_missing: r.ingredients.filter((_, i) => !flags[i]).map((i) => localized(i, language)) })), notice: NOTICE };
  },

  build_missing_ingredients(args) {
    const language = lang(args);
    const id = args.recipe_id;
    if (typeof id !== 'string' || !ID_RE.test(id)) throw new ToolError('Invalid recipe ID');
    const pantryIn = strList(args.pantry, 'pantry');
    if (pantryIn.length > 30 || pantryIn.some((s) => !s.trim() || codepoints(s) > 80)) {
      throw new ToolError('Supply at most 30 nonempty ingredient names of at most 80 characters');
    }
    const words = pantryIn.map(tokens);
    if (words.some((x) => x.size === 0)) throw new ToolError('Each ingredient must contain letters');
    const recipe = BY_ID.get(id);
    if (!recipe) return { error: 'Recipe not found' };
    return { recipe_id: id, recipe_name: localized(recipe.name, language),
      possibly_missing: recipe.ingredients.filter((i) => !covered(i, words)).map((i) => localized(i, language)),
      notice: NOTICE, shopping_list_updated: false,
      handoff: 'Draft only. Not connected to Smart Shopping; review quantities before copying.' };
  },
};
