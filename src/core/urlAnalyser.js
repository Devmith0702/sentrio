// src/core/urlAnalyser.js

function analyseURL(fullURL) {
  try {
    const parsed = new URL(fullURL)
    const hostname = parsed.hostname

    const parts = hostname.split(".")
    const registeredDomain = parts.slice(-2).join(".")
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : ""
    const tld = parts[parts.length - 1]

    const suspiciousTLDs = ["xyz", "net", "online", "site", "click", "info", "top"]
    const hasSuspiciousTLD = suspiciousTLDs.includes(tld)

    return {
      fullURL,
      hostname,
      registeredDomain,
      subdomain,
      tld,
      hasSuspiciousTLD,
      hasHTTPS: parsed.protocol === "https:"
    }

  } catch (e) {
    return null
  }
}
