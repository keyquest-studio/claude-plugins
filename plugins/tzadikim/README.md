# Tzadikim Tombs for Claude

Tzadikim Tombs (קברי צדיקים) by KeyQuest Studio maps tombs of tzadikim in Israel and abroad. This plugin connects Claude to the app's data: 115 sites with locations, short bios, yahrzeit (hilula) dates, nearby sites and navigation links, in Hebrew, English, French and Russian.

## What you can ask
- "איפה קבור הבבא סאלי ואיך מגיעים?"
- "Which tzadikim are buried near Meron? Plan me a short route."
- "What hilulot are coming up this month?"

## Tools (all read-only)
`search_tzadikim`, `get_tzadik`, `find_nearby`, `upcoming_yahrzeits`, `list_regions`.

The plugin does not read or change anything in your Tzadikim Tombs app. Some locations follow tradition and are marked as such. Check access, hours and security instructions before visiting.

## Install
```
claude plugin marketplace add keyquest-studio/claude-plugins
claude plugin install tzadikim@keyquest-studio
```

## Where it works
claude.ai, the Claude desktop and mobile apps, Cowork and Claude Code. Nothing to set up: no account, no API key.

## Privacy
The plugin connects to `tzadikim-mcp.forkflip-mcp.workers.dev` (hosted on Cloudflare). The server is read-only, needs no sign-in, and does not log, store or share request contents. Its only outgoing request downloads the app's public data file. Source: https://github.com/keyquest-studio/claude-plugins/tree/main/tzadikim-server

[Privacy policy](https://tzadikim-mcp.forkflip-mcp.workers.dev/privacy)

## Data sources
Locations and names © OpenStreetMap contributors (ODbL 1.0). Facts from Wikidata (CC0). Text excerpts from Wikipedia (CC BY-SA 4.0; some translated by AI and labelled). Images from Wikimedia Commons, author and licence per image.

Get the app: https://apps.apple.com/il/app/tzadikim-tombs/id6815972609

License: the plugin code and icon are proprietary, personal use only (see LICENSE). The data keeps the licences of its sources listed above.
