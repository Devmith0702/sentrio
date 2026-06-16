const { dbGet, dbSet } = require("./dbSetup")
const { extractFingerprint } = require("./fingerprinter")
const { detectDeviation } = require("./deviationDetector")
const { calculateConfidence, isTrusted } = require("./confidenceScorer")
const { markAsSafe, confirmThreat } = require("./feedbackHandler")

async function getProfileDeviation(domain) {
  try {
    const storedProfile = await dbGet(domain)
    const currentFingerprint = extractFingerprint()
    const deviation = detectDeviation(currentFingerprint, storedProfile)

    updateProfileSilently(domain, currentFingerprint, storedProfile)

    return deviation

  } catch (error) {
    console.warn("Sentrio: Trust profile error:", error)
    return { detected: false, details: "Trust profile unavailable" }
  }
}

async function updateProfileSilently(domain, fingerprint, existingProfile) {
  try {
    if (existingProfile) {
      existingProfile.visitCount += 1
      existingProfile.lastVisited = new Date().toISOString()
      if (!existingProfile.flaggedAsThreat) {
        existingProfile.fingerprint = fingerprint
      }
      await dbSet(existingProfile)
    } else {
      await dbSet({
        domain,
        visitCount: 1,
        firstVisited: new Date().toISOString(),
        lastVisited: new Date().toISOString(),
        fingerprint,
        userConfirmedSafe: false,
        isConsistent: true,
        flaggedAsThreat: false
      })
    }
  } catch (error) {
    console.warn("Sentrio: Could not update trust profile:", error)
  }
}

async function getProfileSummary(domain) {
  const profile = await dbGet(domain)
  if (!profile) return null

  return {
    domain,
    visitCount: profile.visitCount,
    firstVisited: profile.firstVisited,
    lastVisited: profile.lastVisited,
    isTrusted: isTrusted(profile),
    confidence: calculateConfidence(profile),
    flaggedAsThreat: profile.flaggedAsThreat
  }
}

module.exports = { getProfileDeviation, getProfileSummary, markAsSafe, confirmThreat }
