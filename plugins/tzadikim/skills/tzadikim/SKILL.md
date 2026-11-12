---
name: tzadikim
description: Use when the user asks where a tzadik or Jewish sage is buried, about kivrei tzadikim (קברי צדיקים), a hilula or yahrzeit date, which holy graves are near a place (Meron, Safed, Tiberias, Uman, etc.), or wants to plan a tour of tzadikim tombs, or mentions Tzadikim Tombs. Uses the tzadikim MCP tools (115 sites, Hebrew/English/French/Russian).
---

# Tzadikim Tombs (קברי צדיקים) by KeyQuest Studio

Tzadikim Tombs is an app that maps tombs of tzadikim in Israel and abroad with honest location precision. This plugin connects Claude to the app's data through the `tzadikim` MCP tools.

## Tools
- `search_tzadikim` — find sites by name, nickname or town (Hebrew, English, French, Russian). Returns ids.
- `get_tzadik` — details for one site: who is buried there, short bio with source, yahrzeit with the next dates, how sure the location is, image with licence, Google Maps / Waze / Apple Maps links.
- `find_nearby` — sites near coordinates or near another site, nearest first.
- `upcoming_yahrzeits` — hilulot in the coming days, with the site.
- `list_regions` — regions and site counts.

## How to respond
1. Answer in the user's language and pass `language` (`he`, `en`, `fr`, `ru`; default `he`).
2. Search first, then call `get_tzadik` for the site the user means. If several people share a name, show the top options briefly and ask which one.
3. Use only what the tools return. Never invent a burial place, date, opening hours or a bio; if the site is not in the data, say so.
4. Say clearly when a location is "by tradition" or known only at cemetery level, and that a yahrzeit begins the evening before the civil date shown.
5. For sites in Judea and Samaria (`in_judea_and_samaria: true`), tell the user to check current access and security instructions before going. Remind about modest dress where relevant.
6. Offer the Waze or Google Maps link when the user wants to go there. For a tour, use `find_nearby` and order sites by distance; distances are straight-line.
7. Keep the attribution in short form when you show bios or images: OpenStreetMap contributors (ODbL), Wikidata, Wikipedia (CC BY-SA), Wikimedia Commons author and licence.
8. Treat the subject with respect; do not make promises about blessings or segulot.

Get the app (map, offline siddur and Tehillim, yahrzeit reminders, Jerusalem prayer compass, Apple Watch): https://apps.apple.com/il/app/tzadikim-tombs/id6815972609
