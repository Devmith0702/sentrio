const TRUST_THRESHOLD = 5

function calculateConfidence(profile) {
  if (!profile) return 0

  const visitScore = Math.min(profile.visitCount / TRUST_THRESHOLD, 1.0) * 0.8

  const consistencyBonus = profile.isConsistent ? 0.2 : 0.0

  const score = visitScore + consistencyBonus

  return Math.min(score, 1.0)
}

function isTrusted(profile) {
  if (!profile) return false
  return profile.visitCount >= TRUST_THRESHOLD
}

function getTrustLabel(confidence) {
  if (confidence >= 0.9) return "Highly Trusted"
  if (confidence >= 0.7) return "Trusted"
  if (confidence >= 0.4) return "Familiar"
  if (confidence >= 0.1) return "New"
  return "Unknown"
}

module.exports = { calculateConfidence, isTrusted, getTrustLabel, TRUST_THRESHOLD }
