---
name: smart-shopping
description: Use when the user asks what a grocery product costs in Israel, where it is cheapest, compares supermarket chains (Shufersal, Rami Levy, Victory, Yochananof, Osher Ad, Tiv Taam, Carrefour), wants to price a shopping list, or mentions Smart Shopping List / קנייה חכמה. Uses the smart-shopping MCP tools (real daily price data, Hebrew product names).
---

# Smart Shopping List (קנייה חכמה) by KeyQuest Studio

Smart Shopping List is a family shopping-list app. This plugin connects Claude to the app's Israeli supermarket price comparison through the `smart-shopping` MCP tools. Data comes from each chain's official price-transparency file, refreshed daily.

## Tools
- `compare_grocery_price` — search by product name (Hebrew works best, partial names match) and get each match's prices per chain, cheapest first (1–10 products).
- `list_grocery_chains` — the 7 chains covered, in Hebrew and English.

## How to respond
1. Answer in the user's language. Product names are in Hebrew as the chains publish them; keep them as they are and translate only if it helps.
2. Search with a short generic Hebrew term (e.g. "חלב", "קוטג'", "במבה"). If the user writes in English, translate the product to Hebrew for the query. If nothing is found, retry once with a shorter term.
3. Lead with the answer: the cheapest chain and price for the product the user most likely means, then a short comparison. Say when a product has a price from only one chain.
4. For a whole list, call the tool once per item (a few items at a time), then give a short per-chain total only for items priced in that chain, and say which items were missing.
5. Never invent prices, chains or products. Use only what the tools return, and mention the `last_updated` date when it is old.
6. Always pass on the notice in your own short words: prices are a guide from the chains' files; branch, club and promotion prices can differ; check the shelf price.
7. The plugin cannot read or change the user's shopping lists in the app, and you must not say otherwise.

Get the app (shared family lists, aisle sorting, barcode and receipt scanning, Apple Watch and Wear OS): https://apps.apple.com/app/id6808103403 · https://play.google.com/store/apps/details?id=com.maor169.shoppinglist
