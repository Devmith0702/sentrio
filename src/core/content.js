// src/core/content.js
// Depends on all other src/core/ files loaded before this one via manifest.json

// Temporary mock — replace when Person 3's trust-profile module is ready
async function getProfileDeviation(domain) {
  return { detected: false, details: "" }
}

async function runSentrio() {
  try {
    const currentURL = window.location.href

    if (!currentURL.startsWith("http")) return

    const urlData = analyseURL(currentURL)
    if (!urlData) return

    const verifiedBank = getVerifiedBank(urlData.registeredDomain)
    const bankCheck = {
      isVerifiedBank: !!verifiedBank,
      bankClaimed: verifiedBank || (containsBankName(urlData.hostname) ? urlData.hostname : null),
      claimingToBeBank: containsBankName(urlData.hostname)
    }

    const homoglyphResult = detectHomoglyphs(urlData.hostname)
    const subdomainResult = checkSubdomainAbuse(urlData)
    const domResult = scanDOM()
    const profileDeviation = await getProfileDeviation(urlData.registeredDomain)

    const threatSignals = buildThreatSignals(
      urlData,
      bankCheck,
      homoglyphResult,
      subdomainResult,
      domResult,
      profileDeviation
    )

    if (threatSignals.shouldEscalateToAI) {
      chrome.runtime.sendMessage({
        type: "ANALYSE_THREAT",
        payload: threatSignals
      })
    } else {
      chrome.runtime.sendMessage({
        type: "PAGE_SAFE",
        payload: { url: currentURL }
      })
    }

  } catch (error) {
    console.error("Sentrio error:", error)
  }
}

runSentrio()
