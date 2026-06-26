const { isTrusted } = require("./confidenceScorer")

function detectDeviation(currentFingerprint, storedProfile) {

  if (!storedProfile) {
    return {
      detected: false,
      knownDomain: false,
      visitCount: 0,
      sslMismatch: false,
      formActionMismatch: false,
      userFlaggedThreat: false,
      userConfirmedSafe: false,
      details: "Domain not in trust profile — first visit"
    }
  }

  // Past user feedback for this exact domain. Carried on every result so the
  // signal layer can act on it (re-warn / respect a safe override) — see
  // signalBuilder.js.
  const userFlaggedThreat = !!storedProfile.flaggedAsThreat
  const userConfirmedSafe = !!storedProfile.userConfirmedSafe

  // The user explicitly flagged this domain as a threat on a prior visit — always
  // resurface that, regardless of trust level. (Checked before isTrusted because a
  // user can confirm a threat on the very first visit.)
  if (userFlaggedThreat) {
    return {
      detected: true,
      knownDomain: true,
      visitCount: storedProfile.visitCount,
      sslMismatch: false,
      formActionMismatch: false,
      userFlaggedThreat: true,
      userConfirmedSafe,
      details: "You previously flagged this site as a threat."
    }
  }

  if (!isTrusted(storedProfile)) {
    return {
      detected: false,
      knownDomain: true,
      visitCount: storedProfile.visitCount,
      sslMismatch: false,
      formActionMismatch: false,
      userFlaggedThreat: false,
      userConfirmedSafe,
      details: `Domain seen ${storedProfile.visitCount} time(s) — not yet enough visits to establish trust baseline`
    }
  }

  const deviations = []

  if (storedProfile.fingerprint.protocol !== currentFingerprint.protocol) {
    deviations.push("Protocol changed (was HTTPS, now HTTP or vice versa)")
  }

  if (
    storedProfile.fingerprint.loginFormAction &&
    currentFingerprint.loginFormAction &&
    storedProfile.fingerprint.loginFormAction !== currentFingerprint.loginFormAction
  ) {
    deviations.push(
      `Login form now submits to "${currentFingerprint.loginFormAction}" instead of the usual "${storedProfile.fingerprint.loginFormAction}"`
    )
  }

  if (
    storedProfile.fingerprint.pageTitle &&
    currentFingerprint.pageTitle &&
    !titlesAreSimilar(storedProfile.fingerprint.pageTitle, currentFingerprint.pageTitle)
  ) {
    deviations.push(`Page title changed significantly`)
  }

  const detected = deviations.length > 0

  return {
    detected,
    knownDomain: true,
    visitCount: storedProfile.visitCount,
    sslMismatch: deviations.some(d => d.includes("Protocol")),
    formActionMismatch: deviations.some(d => d.includes("form")),
    userFlaggedThreat: false,
    userConfirmedSafe,
    details: detected
      ? deviations.join("; ")
      : `Matches trusted profile (${storedProfile.visitCount} previous visits)`
  }
}

function titlesAreSimilar(title1, title2) {
  const clean1 = title1.toLowerCase().replace(/[^a-z0-9]/g, "")
  const clean2 = title2.toLowerCase().replace(/[^a-z0-9]/g, "")

  const words1 = clean1.split("").slice(0, 10).join("")
  const words2 = clean2.split("").slice(0, 10).join("")

  return words1 === words2
}

module.exports = { detectDeviation }
