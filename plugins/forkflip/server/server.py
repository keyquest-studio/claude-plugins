"""ForkFlip read-only catalog. No device, account or shopping-list access."""
import json
import re
import unicodedata
from pathlib import Path
from typing import Literal
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

BASE = Path(__file__).resolve().parent / 'data'
LANGUAGES = ('he', 'en', 'ru', 'ar', 'fr', 'de', 'es')
MEALS = ('breakfast', 'lunch', 'dinner', 'dessert')
DIETS = ('meat', 'dairy', 'vegetarian', 'vegan', 'keto')
CUISINES = ('mediterranean','middleEastern','italian','asian','thai','mexican','indian','american','french')
NOTICE = ('Recipe labels are informational, not allergy guarantees or kosher certification. '
          'Check every ingredient, preparation and supervision. Ingredient matching is approximate; review quantities and missing items.')
mcp = FastMCP('ForkFlip Recipe Catalog', stateless_http=True, json_response=True)
READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)

def load_catalog():
    recipes = json.loads((BASE / 'recipes.json').read_text(encoding='utf-8'))
    for lang in LANGUAGES[2:]:
        table = json.loads((BASE / f'recipes.{lang}.json').read_text(encoding='utf-8'))
        for r in recipes:
            t = table.get(r['id'])
            if not t: continue
            r['name'][lang] = t['name']
            r['instructions'][lang] = t['instructions']
            for item, value in zip(r['ingredients'], t['ingredients']): item[lang] = value
    return recipes

CATALOG = load_catalog()

def localized(value, language):
    return value.get(language) or value.get('en', '')

def project(r, language, full=False):
    result = {'id': r['id'], 'name': localized(r['name'], language), 'meals': r['meals'],
              'diets': r['diets'], 'cuisine': r['cuisine'], 'prepMinutes': r['prepMinutes'],
              'kosherFriendly': r.get('kosher') is True}
    if full:
        result.update(ingredients=[localized(i, language) for i in r['ingredients']],
                      instructions=localized(r['instructions'], language), notice=NOTICE)
    return result

def filtered(meal=None, diet=None, kosher_only=False, max_minutes=None, cuisine=None):
    if meal is not None and meal not in MEALS: raise ValueError('Invalid meal')
    if diet is not None and diet not in DIETS: raise ValueError('Invalid diet')
    if cuisine is not None and cuisine not in CUISINES: raise ValueError('Invalid cuisine')
    if max_minutes is not None and not 1 <= max_minutes <= 1440: raise ValueError('Invalid maximum time')
    return [r for r in CATALOG if (meal is None or meal in r['meals']) and
            (diet is None or diet in r['diets']) and (not kosher_only or r.get('kosher') is True) and
            (max_minutes is None or r['prepMinutes'] <= max_minutes) and (cuisine is None or r['cuisine'] == cuisine)]

def tokens(s):
    normalized = unicodedata.normalize('NFKC', s).casefold()
    return set(re.findall(r'[^\W\d_]+', normalized, re.UNICODE))

def covered(ingredient, pantry):
    # Require all words in a supplied phrase to occur in the same language variant.
    return any(words and words <= tokens(variant) for words in pantry for variant in ingredient.values())

@mcp.tool(annotations=READ_ONLY)
def list_recipes(language: Literal['he','en','ru','ar','fr','de','es']='en', meal: Literal['breakfast','lunch','dinner','dessert'] | None=None, diet: Literal['meat','dairy','vegetarian','vegan','keto'] | None=None, kosher_only: bool=False, max_minutes: int | None=None, cuisine: Literal['mediterranean','middleEastern','italian','asian','thai','mexican','indian','american','french'] | None=None, offset: int=0, limit: int=10) -> dict:
    """List original ForkFlip recipes using optional filters and pagination. Diet labels are not allergy guarantees."""
    if not 0 <= offset <= 10000 or not 1 <= limit <= 25: raise ValueError('Invalid pagination')
    results = filtered(meal, diet, kosher_only, max_minutes, cuisine)
    return {'total': len(results), 'offset': offset, 'recipes': [project(r, language) for r in results[offset:offset+limit]], 'notice': NOTICE}

@mcp.tool(annotations=READ_ONLY)
def get_recipe(recipe_id: str, language: Literal['he','en','ru','ar','fr','de','es']='en') -> dict:
    """Get ingredients and instructions for an original catalog recipe ID."""
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', recipe_id): raise ValueError('Invalid recipe ID')
    recipe = next((r for r in CATALOG if r['id'] == recipe_id), None)
    if recipe is None: return {'error': 'Recipe not found'}
    return project(recipe, language, True)

@mcp.tool(annotations=READ_ONLY)
def suggest_meals(language: Literal['he','en','ru','ar','fr','de','es']='en', meal: Literal['breakfast','lunch','dinner','dessert'] | None=None, diet: Literal['meat','dairy','vegetarian','vegan','keto'] | None=None, kosher_only: bool=False, max_minutes: int | None=None, cuisine: Literal['mediterranean','middleEastern','italian','asian','thai','mexican','indian','american','french'] | None=None) -> dict:
    """Suggest up to three real recipes matching the requested filters."""
    import secrets
    options = filtered(meal, diet, kosher_only, max_minutes, cuisine)
    return {'total_matches': len(options), 'recipes': [project(r, language) for r in secrets.SystemRandom().sample(options, min(3, len(options)))], 'notice': NOTICE}

@mcp.tool(annotations=READ_ONLY)
def match_pantry(ingredients: list[str], language: Literal['he','en','ru','ar','fr','de','es']='en', meal: Literal['breakfast','lunch','dinner','dessert'] | None=None) -> dict:
    """Find recipes with ingredient text matching items supplied in this request; no personal pantry is read or saved."""
    if not 1 <= len(ingredients) <= 30 or any(not isinstance(s,str) or not s.strip() or len(s)>80 for s in ingredients): raise ValueError('Supply 1–30 nonempty ingredient names, each at most 80 characters')
    pantry = [tokens(s) for s in ingredients]
    if any(not x for x in pantry): raise ValueError('Each ingredient must contain letters')
    matches = []
    for r in filtered(meal=meal):
        have = [covered(i, pantry) for i in r['ingredients']]
        if any(have):
            matches.append((sum(have), r, have))
    matches.sort(key=lambda x: -x[0])
    return {'recipes': [{**project(r,language), 'matched_count': count, 'possibly_missing': [localized(i,language) for i, yes in zip(r['ingredients'], flags) if not yes]} for count,r,flags in matches[:10]], 'notice': NOTICE}

@mcp.tool(annotations=READ_ONLY)
def build_missing_ingredients(recipe_id: str, pantry: list[str], language: Literal['he','en','ru','ar','fr','de','es']='en') -> dict:
    """Prepare a draft of potentially missing ingredients for one recipe; never writes to Smart Shopping."""
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', recipe_id): raise ValueError('Invalid recipe ID')
    if len(pantry) > 30 or any(not isinstance(s, str) or not s.strip() or len(s) > 80 for s in pantry):
        raise ValueError('Supply at most 30 nonempty ingredient names of at most 80 characters')
    words = [tokens(s) for s in pantry]
    if any(not x for x in words): raise ValueError('Each ingredient must contain letters')
    recipe = next((r for r in CATALOG if r['id'] == recipe_id), None)
    if recipe is None: return {'error': 'Recipe not found'}
    return {'recipe_id': recipe_id, 'recipe_name': localized(recipe['name'], language),
            'possibly_missing': [localized(i, language) for i in recipe['ingredients'] if not covered(i, words)],
            'notice': NOTICE, 'shopping_list_updated': False,
            'handoff': 'Draft only. Not connected to Smart Shopping; review quantities before copying.'}

if __name__ == '__main__':
    import os
    # STDIO is for local testing. Public HTTP deployment requires a reviewed reverse proxy,
    # access logging policy, rate limits, resource limits and HTTPS.
    mcp.run(transport='streamable-http' if os.getenv('FORKFLIP_HTTP') == '1' else 'stdio')
