// src/core/homoglyphDetector.js
// Depends on: bankRegistry.js (containsBankName global, loaded before this file)

// Cyrillic look-alikes: no legitimate domain swaps a Latin letter for an
// identical-looking Cyrillic one, so these are ALWAYS deceptive.
const CYRILLIC_MAP = {
  'а': 'a',  // Cyrillic а → Latin a
  'е': 'e',  // Cyrillic е → Latin e
  'о': 'o',  // Cyrillic о → Latin o
  'р': 'p',  // Cyrillic р → Latin p
  'с': 'c',  // Cyrillic с → Latin c
  'х': 'x',  // Cyrillic х → Latin x
  'і': 'i'   // Cyrillic і → Latin i
}

// ASCII substitutions used to disguise a brand (g00gle, arnazon, samp1e).
// These characters appear in countless ordinary words ("modern", "learn",
// "web01"), so they are ONLY treated as homoglyphs when undoing the
// substitution reveals a bank name the original was hiding.
const ASCII_LOOKALIKE_MAP = {
  '0': 'o',
  '1': 'l',
  'rn': 'm'
}

function detectHomoglyphs(domain) {
  const detected = []

  // 1. Cyrillic / mixed-script look-alikes — always suspicious
  for (const [fake, real] of Object.entries(CYRILLIC_MAP)) {
    if (domain.includes(fake)) {
      detected.push({
        character: fake,
        looksLike: real,
        position: domain.indexOf(fake)
      })
    }
  }

  // 2. Unicode normalisation mismatch — hidden non-ASCII characters
  if (domain.normalize("NFKD") !== domain) {
    detected.push({
      character: "unicode",
      looksLike: "normalisation mismatch detected",
      position: -1
    })
  }

  // 3. ASCII substitutions — only flag if undoing them exposes a bank name.
  //    "modern.com" → "modem.com" (not a bank) → ignored.
  //    "c0mbank.lk" → "combank.lk" (a bank) → flagged.
  let substituted = domain
  for (const [fake, real] of Object.entries(ASCII_LOOKALIKE_MAP)) {
    substituted = substituted.split(fake).join(real)
  }
  if (
    substituted !== domain &&
    typeof containsBankName === "function" &&
    containsBankName(substituted) &&
    !containsBankName(domain)
  ) {
    detected.push({
      character: "ascii-substitution",
      looksLike: substituted,
      position: -1
    })
  }

  return {
    detected: detected.length > 0,
    details: detected
  }
}

// ── Brand (visible-text) homoglyphs ──────────────────────────────────────────
// A spoof can also live in the page's VISIBLE branding, not just the domain:
// "Ηatton National Bank" with a Greek capital Eta, "Ѕampath" with a Cyrillic Es.
// This map keys each look-alike character → its Latin twin (lowercase; the bank
// check is case-insensitive anyway). Covers Cyrillic and Greek upper/lowercase.
const BRAND_CONFUSABLE_MAP = {
  // Cyrillic
  'А':'a','В':'b','Е':'e','К':'k','М':'m','Н':'h','О':'o','Р':'p','С':'c','Т':'t','Х':'x','І':'i','Ѕ':'s',
  'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','і':'i','ѕ':'s','п':'n',
  // Greek
  'Α':'a','Β':'b','Ε':'e','Ζ':'z','Η':'h','Ι':'i','Κ':'k','Μ':'m','Ν':'n','Ο':'o','Ρ':'p','Τ':'t','Υ':'y','Χ':'x',
  'α':'a','ο':'o','ρ':'p','τ':'t','κ':'k','ι':'i','ε':'e','ν':'v'
}

function deconfuseBrand(str) {
  let out = ""
  for (const ch of str) out += (BRAND_CONFUSABLE_MAP[ch] !== undefined ? BRAND_CONFUSABLE_MAP[ch] : ch)
  return out
}

// Detect a bank brand name disguised with mixed-script look-alikes in the page's
// visible text. Works token-by-token and only fires when un-confusing a token
// reveals a bank name the RAW token did not already spell. That gate keeps it
// silent on (a) legitimate multilingual pages — Sinhala/Tamil characters aren't in
// the map, so those tokens are unchanged and skipped — and (b) plain-ASCII bank
// names, where nothing was disguised. Only a deliberate script swap inside a bank
// word trips it.
function detectBrandHomoglyphs(text) {
  if (!text || typeof containsBankName !== "function") {
    return { detected: false, details: [] }
  }
  const tokens = String(text).split(/[^\p{L}\p{N}]+/u)
  for (const token of tokens) {
    if (token.length < 3) continue
    const deconfused = deconfuseBrand(token)
    if (deconfused === token) continue                       // no look-alike chars here
    if (containsBankName(deconfused) && !containsBankName(token)) {
      return {
        detected: true,
        details: [{ character: "brand-homoglyph", raw: token, looksLike: deconfused, position: -1 }]
      }
    }
  }
  return { detected: false, details: [] }
}
