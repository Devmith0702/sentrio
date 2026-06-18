// src/trustProfileBundle.js
// Parcel entry — bundles Layer 3 (trust profile) and exposes it as a single
// global, `SentrioTrust`, for the content scripts to call. The underlying
// modules in src/trust-profile/* stay as the tested CommonJS source of truth.
//
// Layer 3 runs in the PAGE context because it needs:
//   - the DOM, to fingerprint the page (fingerprinter.js)
//   - per-origin IndexedDB, which conveniently isolates each site's profile
//     (a phishing clone can't read or poison the real bank's stored profile)

const { getProfileDeviation, getProfileSummary } = require("./trust-profile/profileManager")
const { markAsSafe, confirmThreat }              = require("./trust-profile/feedbackHandler")
const { extractFingerprint }                     = require("./trust-profile/fingerprinter")

// Derive the registered domain from the current page so deviation detection and
// user feedback use the SAME key. analyseURL is a global defined by the
// src/core/urlAnalyser.js content script (loaded before this bundle).
function currentDomain() {
  try {
    if (typeof globalThis.analyseURL === "function") {
      return globalThis.analyseURL(window.location.href).registeredDomain
    }
  } catch (_) {}
  return window.location.hostname
}

globalThis.SentrioTrust = {
  // Read path — called by content.js to add a deviation signal.
  getProfileDeviation: (domain) => getProfileDeviation(domain || currentDomain()),
  getProfileSummary:   (domain) => getProfileSummary(domain || currentDomain()),

  // Feedback path — called by the overlay's Mark-Safe / Confirm-Threat buttons.
  markAsSafe:    (domain) => markAsSafe(domain || currentDomain(), extractFingerprint()),
  confirmThreat: (domain) => confirmThreat(domain || currentDomain()),
}
