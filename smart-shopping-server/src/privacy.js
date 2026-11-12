import { LOGO_PNG_BASE64 } from './logo.js';

export const PRIVACY_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Smart Shopping List for Claude – Privacy Policy</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#222;background:#fff}h1{font-size:1.6em;margin:.4em 0}.brand{display:flex;align-items:center;gap:16px;margin-bottom:8px}.brand img{width:72px;height:72px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.15)}h2{font-size:1.15em;margin-top:1.6em}@media(prefers-color-scheme:dark){body{color:#eee;background:#151515}a{color:#7cc4ff}}</style></head><body>
<div class="brand"><img src="data:image/png;base64,${LOGO_PNG_BASE64}" alt="Smart Shopping List logo" width="72" height="72"><h1>Smart Shopping List for Claude – Privacy Policy</h1></div>
<p>Effective: 12 November 2026. Publisher: KeyQuest Studio (<a href="https://1clicksoft.net">1clicksoft.net</a>).</p>
<p>This policy covers the Smart Shopping List (קנייה חכמה) plugin for Claude and its price server at <code>smart-shopping-mcp.forkflip-mcp.workers.dev</code>.</p>
<h2>What the service does</h2>
<p>It compares Israeli supermarket prices for a product name you ask about, using the chains' official price-transparency files. All tools are read-only. There are no accounts, sign-in, payments or user profiles.</p>
<h2>What we receive</h2>
<p>Only the tool requests Claude sends to answer you: a product search term (for example "milk") and how many results to show. Please don't include personal information in search terms.</p>
<h2>Where it goes</h2>
<p>The search term is forwarded to the Smart Shopping List app's own price service (Google Firebase, project of KeyQuest Studio) to look up prices. Nothing else about you is sent. The server also downloads the app's public list of price-controlled products (such as eggs and milk); no search term is sent with it. The answer for a search term may be cached on Cloudflare for up to 6 hours so repeated searches are faster; the cache holds prices, not who asked.</p>
<h2>What we keep</h2>
<p>We do not log, store, sell or share request contents or tie them to a person. To enforce rate limits, our host (Cloudflare) briefly counts requests per IP address in memory; this count is not stored by us. Cloudflare and Google may process connection data as our infrastructure providers under their own privacy policies.</p>
<h2>Your shopping lists</h2>
<p>The plugin cannot read or change your Smart Shopping List app, your lists, members or purchases.</p>
<h2>Children</h2>
<p>The service is not directed to children under 13 and collects no personal data from anyone.</p>
<h2>Prices</h2>
<p>Prices are a daily guide from the chains' published files. Branch, club and promotional prices can differ. Always check the shelf price.</p>
<h2>Changes and contact</h2>
<p>Updates are published on this page and in the <a href="https://github.com/keyquest-studio/claude-plugins">public repository</a>. Questions: <a href="https://1clicksoft.net">1clicksoft.net</a> or <a href="https://github.com/keyquest-studio/claude-plugins/issues">GitHub issues</a>.</p>
</body></html>`;
