# ForkFlip for Claude

ForkFlip by KeyQuest Studio helps you decide what to eat. This plugin connects Claude to the ForkFlip recipe catalog: 163 original recipes in Hebrew, English, Russian, Arabic, French, German and Spanish.

## What you can ask
- "ForkFlip: pick an easy dinner for two, under 25 minutes."
- "I have eggs, tomatoes, rice and cheese. What can we cook?"
- "Choose a vegetarian lunch and make a list of what I'm missing."

## Tools (all read-only)
`suggest_meals`, `list_recipes`, `get_recipe`, `match_pantry`, `build_missing_ingredients`.

The plugin does not read or change your ForkFlip app, pantry, purchases or Smart Shopping List. Ingredient lists you type are used only for that request. Missing-ingredient results are drafts to copy.

Diet labels are informational. "Kosher-friendly" is not a kashrut certification. Check allergens on packaging.

## Install
```
claude plugin marketplace add keyquest-studio/claude-plugins
claude plugin install forkflip@keyquest-studio
```

## Setup
Needs Python 3.10+ or `uv`. On first start the server creates a private environment in `~/.cache/forkflip-claude-plugin` and installs the `mcp` package.

Get the app: https://apps.apple.com/app/forkflip-what-to-eat-tonight/id6811795227

License: proprietary, personal use only. See LICENSE.
