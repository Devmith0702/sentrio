function extractFingerprint() {

  const sslIssuer = extractSSLInfo()

  const loginFormAction = extractLoginFormAction()

  const pageTitle = document.title

  const sessionStart = Date.now()

  return {
    sslIssuer,
    loginFormAction,
    pageTitle,
    sessionStart,
    protocol: window.location.protocol,
    hostname: window.location.hostname
  }
}

// Chrome MV3 extensions cannot read the live TLS certificate of a page — there is
// no webRequest security-info / cert API (that's Firefox-only). So `issuer` stays
// null here. The TLS issuer signal is instead obtained out-of-band via Certificate
// Transparency logs (crt.sh) in the Layer 2.5 grounding step — see
// lookupIssuerCA() in src/ai-agent/grounding.js — and reasoned over by the AI.
function extractSSLInfo() {
  return {
    usesHTTPS: window.location.protocol === "https:",
    issuer: null
  }
}

function extractLoginFormAction() {
  const passwordInputs = document.querySelectorAll("input[type='password']")
  if (passwordInputs.length === 0) return null

  const form = passwordInputs[0].closest("form")
  if (!form) return null

  const action = form.getAttribute("action")
  if (!action) return window.location.hostname

  try {
    const resolved = new URL(action, window.location.href)
    return resolved.hostname
  } catch {
    return action
  }
}

module.exports = { extractFingerprint }
