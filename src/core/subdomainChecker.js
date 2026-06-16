// src/core/subdomainChecker.js
// Depends on: bankRegistry.js (getVerifiedBank, containsBankName globals)

function checkSubdomainAbuse(urlData) {
  const { subdomain, registeredDomain } = urlData

  if (!subdomain) return { detected: false }

  if (getVerifiedBank(registeredDomain)) return { detected: false }

  if (containsBankName(subdomain)) {
    return {
      detected: true,
      details: `Bank name "${subdomain}" used as subdomain of unrelated domain "${registeredDomain}"`
    }
  }

  return { detected: false }
}
