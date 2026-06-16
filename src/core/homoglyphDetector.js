// src/core/homoglyphDetector.js

const HOMOGLYPH_MAP = {
  'а': 'a',  // Cyrillic а → Latin a
  'е': 'e',  // Cyrillic е → Latin e
  'о': 'o',  // Cyrillic о → Latin o
  'р': 'p',  // Cyrillic р → Latin p
  'с': 'c',  // Cyrillic с → Latin c
  'х': 'x',  // Cyrillic х → Latin x
  'і': 'i',  // Cyrillic і → Latin i
  '0': 'o',
  '1': 'l',
  'rn': 'm'
}

function detectHomoglyphs(domain) {
  const detected = []

  for (const [fake, real] of Object.entries(HOMOGLYPH_MAP)) {
    if (domain.includes(fake)) {
      detected.push({
        character: fake,
        looksLike: real,
        position: domain.indexOf(fake)
      })
    }
  }

  const normalised = domain.normalize("NFKD")
  if (normalised !== domain) {
    detected.push({
      character: "unicode",
      looksLike: "normalisation mismatch detected",
      position: -1
    })
  }

  return {
    detected: detected.length > 0,
    details: detected
  }
}
