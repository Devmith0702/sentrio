# Sentrio
Agentic AI browser extension for detecting social engineering targeting Sri Lankan banking users.

## Team — Mora Vortex
Built for Aurora 2026 | University of Moratuwa

## Branch Structure
- `dev` — integration branch, everyone merges here
- `P1` — Core Extension Shell + Layer 1 Local Checks
- `P2` — LLM API Integration (Groq) + Layer 2 AI Reasoning
- `P3` — Personal Trust Profile System + Layer 3 Learning
- `P4` — Alert Overlay + Extension Popup UI

## AI Provider
Layer 2 reasoning runs on **Groq** (`llama-3.3-70b-versatile`) by default — free and
fast for development and the demo. The provider is selectable via `CONFIG.PROVIDER`
in `src/ai-agent/config.js` (`groq` | `gemini` | `claude`); a Claude code path exists
for an optional Anthropic-backed run but is not the default.

## Run it locally (fork, build & load)
Sentrio is an unpacked Chrome (Manifest V3) extension. Follow these steps to get it
running in your own browser.

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer (includes `npm`)
- Google Chrome, or any Chromium browser (Edge, Brave, etc.)

### 1. Fork and clone
Click **Fork** at the top-right of this repo to copy it to your own GitHub account,
then clone your fork (replace `YOUR-USERNAME`):

```bash
git clone https://github.com/YOUR-USERNAME/sentrio.git
cd sentrio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your AI API key
Layer 2 reasoning needs an API key. The config file holds your key and is **git-ignored**,
so you must create it from the template:

```bash
cp src/ai-agent/config.example.js src/ai-agent/config.js
```

Open `src/ai-agent/config.js` and paste in a key for your chosen provider. The default
is **Groq** — grab a free key at <https://console.groq.com/keys>. (You can also set
`CONFIG.PROVIDER` to `gemini` or `claude` and supply that provider's key instead.)

### 4. Build the extension
This bundles the popup, overlay, and trust-profile code into the `dist/` folder that
the manifest points to:

```bash
npm run build
```

### 5. Load it into Chrome
1. Open `chrome://extensions` in your browser.
2. Turn on **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the **root folder of this repo** (the one containing `manifest.json`).
5. Sentrio appears in your toolbar — click the puzzle-piece icon and **pin** it.

That's it — browse to a banking site (or one of the test pages) and Sentrio will start
analysing. Open the popup from the toolbar to see the current tab's verdict.

### Updating after code changes
Whenever you change the source, rebuild and reload:

```bash
npm run build
```
Then go to `chrome://extensions` and click the **reload** ↻ icon on the Sentrio card.

> **Tip:** while developing the overlay or trust-profile bundles, you can run
> `npm run watch:overlay` or `npm run watch:trust` to rebuild automatically on save
> (you still need to reload the extension in Chrome to pick up the changes).

## Permissions
Sentrio requests the **minimum** needed:
- `activeTab` — lets the popup read the current tab's URL on click.
- `host_permissions: <all_urls>` — required because phishing can appear on *any*
  domain, so the Layer 1 content script must run everywhere, and the background
  worker fetches grounding evidence (official bank sites, RDAP, crt.sh) over HTTPS.

No `storage` or `notifications` permission is used: the trust profile lives in
per-origin **IndexedDB** (no permission needed) and status is shown via the toolbar
badge + overlay rather than OS notifications.

## Shared Interface
See `src/interfaces.js` for the agreed data contracts between all components.
