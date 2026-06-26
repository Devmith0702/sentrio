// src/core/content.js
// Depends on all other src/core/ files loaded before this one via manifest.json

// Layer 3 (trust profile) is bundled into dist/trustProfileBundle.js and exposed
// as the global SentrioTrust, loaded as a content script before this file.
// Falls back to "no deviation" if the bundle isn't present, so detection never
// breaks just because the trust layer failed to load.
async function getProfileDeviation(domain) {
  try {
    if (typeof SentrioTrust !== "undefined" && SentrioTrust.getProfileDeviation) {
      return await SentrioTrust.getProfileDeviation(domain)
    }
  } catch (error) {
    console.warn("Sentrio: trust profile unavailable —", error)
  }
  return { detected: false, details: "" }
}

// A compact fingerprint of the signals that actually drive a verdict. We re-scan
// the page on every DOM mutation / SPA navigation, but only message the
// background when this fingerprint changes — otherwise a busy page would spam the
// AI (one Groq call per mutation) and re-flash the overlay. The URL is included
// so SPA route changes always count as "changed".
function signatureOf(s) {
  return [
    s.url,
    s.shouldEscalateToAI ? 1 : 0,
    s.isBankImpersonation ? 1 : 0,
    s.homoglyphDetected ? 1 : 0,
    s.subdomainAbuse ? 1 : 0,
    s.hiddenTextFound ? 1 : 0,
    s.loginFormPresent ? 1 : 0,
    s.suspiciousFormActions.length,
    s.profileDeviation.detected ? 1 : 0,
  ].join("|")
}

let lastSignature = null

// Visible branding most likely to carry an impersonated bank name: the tab title,
// top headings, and logo alt text. Capped so a huge page can't blow up the scan.
function getBrandText() {
  const parts = []
  if (document.title) parts.push(document.title)
  document.querySelectorAll("h1, h2, img[alt]").forEach(el => {
    const t = el.tagName === "IMG" ? el.getAttribute("alt") : el.textContent
    if (t) parts.push(t)
  })
  return parts.join(" ").slice(0, 3000)
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
    // Also check the visible branding — a look-alike bank name in the page title or
    // logo is impersonation even when the domain itself looks clean. Merge into the
    // same result so it escalates through the existing homoglyph signal.
    const brandResult = detectBrandHomoglyphs(getBrandText())
    if (brandResult.detected) {
      homoglyphResult.detected = true
      homoglyphResult.details = homoglyphResult.details.concat(brandResult.details)
    }
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

    // Skip when nothing verdict-relevant changed since the last scan. This is what
    // makes the MutationObserver safe: bursts of irrelevant DOM churn (and the
    // overlay injecting itself) re-run the scan but never re-message.
    const signature = signatureOf(threatSignals)
    if (signature === lastSignature) return
    lastSignature = signature

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

// Debounce re-scans: a single page load or SPA navigation fires many mutations in
// a burst, so we coalesce them into one analysis pass.
let rescanTimer = null
function scheduleRescan() {
  if (rescanTimer) clearTimeout(rescanTimer)
  rescanTimer = setTimeout(() => {
    rescanTimer = null
    runSentrio()
  }, 800)
}

// Initial scan on page load.
runSentrio()

// Re-scan when the page changes after load:
//   • DOM mutations — phishing login forms / hidden injection text added later,
//     and the content swap that accompanies an SPA route change (runSentrio
//     re-reads location.href, so the new URL is picked up via the signature).
//   • popstate — back/forward navigation within an SPA.
// NOTE: we deliberately do NOT patch history.pushState — content scripts run in
// an isolated world, so the patch wouldn't intercept the page's own calls. The
// MutationObserver covers SPA navigations in practice.
//
// Guarded so content.js never throws in a minimal/non-browser context (e.g. the
// VM-sandboxed test harness, or a chrome:// page with no real document).
if (typeof MutationObserver !== "undefined" && document.documentElement) {
  new MutationObserver(scheduleRescan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("popstate", scheduleRescan)
}
