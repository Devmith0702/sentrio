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
