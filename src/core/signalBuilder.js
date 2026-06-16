// src/core/signalBuilder.js

function buildThreatSignals(urlData, bankCheck, homoglyphResult, subdomainResult, domResult, profileDeviation) {

  const isBankImpersonation =
    bankCheck.claimingToBeBank &&
    !bankCheck.isVerifiedBank

  const hasAnySignal =
    isBankImpersonation ||
    homoglyphResult.detected ||
    subdomainResult.detected ||
    domResult.injectionFound ||
    domResult.suspiciousFormActions.length > 0 ||
    urlData.hasSuspiciousTLD ||
    profileDeviation.detected

  return {
    shouldEscalateToAI: hasAnySignal,
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
