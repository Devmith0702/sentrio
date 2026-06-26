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

## Setup
The AI config holds API keys and is git-ignored. Copy the template and fill in a key:

```
cp src/ai-agent/config.example.js src/ai-agent/config.js
# then edit config.js and set the API key for your chosen provider
npm install && npm run build
```

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
