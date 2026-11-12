# Smart Shopping List for Claude

Smart Shopping List (קנייה חכמה) by KeyQuest Studio is a family shopping-list app. This plugin connects Claude to the app's Israeli supermarket price comparison: Shufersal, Victory, Rami Levy, Yochananof, Osher Ad, Tiv Taam and Carrefour, from each chain's official daily price-transparency file.

## What you can ask
- "Where is Tnuva milk cheapest right now?"
- "כמה עולה קוטג' ברמי לוי לעומת שופרסל?"
- "Price this list for me: milk, bread, eggs, Bamba. Which chain comes out cheapest?"

## Tools (all read-only)
`compare_grocery_price`, `list_grocery_chains`.

The plugin does not read or change your Smart Shopping List app, lists or members. Prices are a guide: branch, club and promotion prices can differ, so check the shelf price.

## Install
```
claude plugin marketplace add keyquest-studio/claude-plugins
claude plugin install smart-shopping@keyquest-studio
```

## Where it works
claude.ai, the Claude desktop and mobile apps, Cowork and Claude Code. Nothing to set up: no account, no API key.

## Privacy
The plugin connects to the price server at `smart-shopping-mcp.forkflip-mcp.workers.dev` (hosted on Cloudflare). The server forwards only the product search term to the app's own price service (Google Firebase) and may cache the prices for that term for up to 6 hours. It needs no sign-in and does not log, store or share request contents. Source: https://github.com/keyquest-studio/claude-plugins/tree/main/smart-shopping-server

[Privacy policy](https://smart-shopping-mcp.forkflip-mcp.workers.dev/privacy)

Get the app: https://apps.apple.com/app/id6808103403 · https://play.google.com/store/apps/details?id=com.maor169.shoppinglist

License: proprietary, personal use only. See LICENSE.
