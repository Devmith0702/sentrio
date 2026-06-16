# Sentrio Extension Icons

Place extension icons in this directory:

- `icon16.png`  — 16×16px  (favicon, toolbar)
- `icon48.png`  — 48×48px  (extensions management page)
- `icon128.png` — 128×128px (Chrome Web Store)

## Design Notes
- Use the Sentrio shield design on a navy (#0f3460) background
- The shield should incorporate the accent blue (#00b4d8) gradient
- Export as PNG with transparency

## Usage in manifest.json
```json
"icons": {
  "16":  "dist/ui/icons/icon16.png",
  "48":  "dist/ui/icons/icon48.png",
  "128": "dist/ui/icons/icon128.png"
},
"action": {
  "default_popup": "dist/ui/popup.html",
  "default_icon": {
    "16":  "dist/ui/icons/icon16.png",
    "48":  "dist/ui/icons/icon48.png"
  }
}
```
