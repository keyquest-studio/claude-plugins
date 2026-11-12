import { LOGO_PNG_BASE64 } from './logo.js';

export const PRIVACY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tzadikim Tombs for Claude – Privacy Policy</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#222;background:#fff}h1{font-size:1.6em;margin:.4em 0}.brand{display:flex;align-items:center;gap:16px;margin-bottom:8px}.brand img{width:72px;height:72px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.15)}h2{font-size:1.15em;margin-top:1.6em}@media(prefers-color-scheme:dark){body{color:#eee;background:#151515}a{color:#e6c36a}}</style></head><body>
<div class="brand"><img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Tzadikim Tombs logo" width="72" height="72"><h1>Tzadikim Tombs for Claude – Privacy Policy</h1></div>
<p>Effective: 12 November 2026. Publisher: KeyQuest Studio (<a href="https://1clicksoft.net">1clicksoft.net</a>).</p>
<p>This policy covers the Tzadikim Tombs (קברי צדיקים) plugin for Claude and its server at <code>tzadikim-mcp.forkflip-mcp.workers.dev</code>.</p>
<h2>What the service does</h2>
<p>It returns information about tombs of tzadikim from the Tzadikim Tombs app's public data: names, locations, short biographies, yahrzeit dates and map links. All tools are read-only. There are no accounts, sign-in, payments or user profiles.</p>
<h2>What we receive</h2>
<p>Only the tool requests Claude sends to answer you: a name or town to search, a site id, a language, a date range, or coordinates if you ask what is near a place. Please don't include personal information.</p>
<h2>What we keep</h2>
<p>Nothing. The server does not log, store, sell or share request contents. It sends nothing about you to anyone: its only outgoing request downloads the app's public data file, which is cached for up to an hour. To enforce rate limits, our host (Cloudflare) briefly counts requests per IP address in memory; this count is not stored by us. Cloudflare and Google (which hosts the data file) may process connection data as our infrastructure providers under their own privacy policies.</p>
<h2>The app</h2>
<p>The plugin cannot read or change anything in your Tzadikim Tombs app, such as saved sites or reminders.</p>
<h2>Children</h2>
<p>The service is not directed to children under 13 and collects no personal data from anyone.</p>
<h2>Accuracy and sources</h2>
<p>Some locations follow tradition rather than proven burial, and are marked as such. Locations and names © OpenStreetMap contributors (ODbL); facts from Wikidata (CC0); text excerpts from Wikipedia (CC BY-SA 4.0); images from Wikimedia Commons under each author's licence. Check access, hours and security instructions before visiting.</p>
<h2>Changes and contact</h2>
<p>Updates are published on this page and in the <a href="https://github.com/keyquest-studio/claude-plugins">public repository</a>. Questions: <a href="https://1clicksoft.net">1clicksoft.net</a> or <a href="https://github.com/keyquest-studio/claude-plugins/issues">GitHub issues</a>.</p>
</body></html>`;
