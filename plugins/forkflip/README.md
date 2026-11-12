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

## Where it works
claude.ai, the Claude desktop and mobile apps, Cowork and Claude Code. Nothing to set up: no Python, no account, no API key.

## Privacy
The plugin connects to the ForkFlip recipe server at `forkflip-mcp.forkflip-mcp.workers.dev` (hosted on Cloudflare), its only network destination. The server is read-only, needs no sign-in, and does not log, store or share request contents. Ingredients you type are used only to answer that request. Source: https://github.com/keyquest-studio/claude-plugins/tree/main/remote-server

[Privacy policy](https://forkflip-mcp.forkflip-mcp.workers.dev/privacy)

Get the app: https://apps.apple.com/app/forkflip-what-to-eat-tonight/id6811795227

License: proprietary, personal use only. See LICENSE.
