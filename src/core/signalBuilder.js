// src/core/signalBuilder.js

function buildThreatSignals(urlData, bankCheck, homoglyphResult, subdomainResult, domResult, profileDeviation) {

  const isBankImpersonation =
    bankCheck.claimingToBeBank &&
    !bankCheck.isVerifiedBank

  // Strong signals — inherently bank-related, so they escalate on their own.
  const strongSignal =
    isBankImpersonation ||
    homoglyphResult.detected ||      // now only fires on real bank look-alikes
    subdomainResult.detected ||
    profileDeviation.detected

  // A "banking nexus" means the page is a plausible banking-phishing target:
  // it either names a bank or collects credentials (a login/password form).
  const bankingNexus =
    bankCheck.claimingToBeBank ||
    domResult.loginFormPresent

  // Contextual signals also appear all over ordinary sites: a .net/.info TLD, a
  // form posting to a CDN, or injection-style phrases buried in embedded JSON /
  // app state (e.g. ChatGPT's session blob). On their own they're noise — they
  // only escalate alongside a banking nexus, so normal browsing never burns an
  // AI call.
  const contextualSignal =
    domResult.injectionFound ||
    urlData.hasSuspiciousTLD ||
    domResult.suspiciousFormActions.length > 0

  const hasAnySignal =
    strongSignal ||
    (contextualSignal && bankingNexus)

  // Respect a user "Mark as safe" override: once the user has explicitly trusted
  // this domain, stay silent — UNLESS the page has since deviated from the stored
  // fingerprint (SSL / form / title), in which case profileDeviation.detected is
  // true and we escalate anyway. (deviationDetector sets userConfirmedSafe;
  // confirmThreat instead forces profileDeviation.detected=true, which is a strong
  // signal here, so a flagged domain is never silenced by this clause.)
  const userOverrodeSafe =
    profileDeviation.userConfirmedSafe === true && !profileDeviation.detected

  return {
    shouldEscalateToAI: hasAnySignal && !userOverrodeSafe,
    timestamp: new Date().toISOString(),

    url: urlData.fullURL,
    registeredDomain: urlData.registeredDomain,
    subdomain: urlData.subdomain,
    hasSuspiciousTLD: urlData.hasSuspiciousTLD,
    hasHTTPS: urlData.hasHTTPS,

    isBankImpersonation,
    isVerifiedBank: bankCheck.isVerifiedBank,
    bankClaimed: bankCheck.bankClaimed || "",

    homoglyphDetected: homoglyphResult.detected,
    homoglyphDetails: homoglyphResult.details,
    subdomainAbuse: subdomainResult.detected,
    subdomainDetails: subdomainResult.details || "",
    hiddenTextFound: domResult.injectionFound,
    hiddenTextContent: domResult.injectionDetails.map(d => d.content).join(" | "),
    suspiciousFormActions: domResult.suspiciousFormActions,
    loginFormPresent: domResult.loginFormPresent,

    profileDeviation: {
      detected: profileDeviation.detected,
      details: profileDeviation.details || ""
    }
  }
}
