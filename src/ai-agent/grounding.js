// src/ai-agent/grounding.js
// Layer 2.5 — Evidence grounding for bank-impersonation verdicts.
//
// WHY THIS EXISTS
// The bank registry (src/core/bankRegistry.js) is an exact-match allowlist, so
// ANY legitimate bank-owned domain that isn't literally one of the listed
// strings (campaign microsites, a bank's .com when we only listed the .lk, new
// banks…) is reported as impersonation. That binary is the main false-positive
// source. Instead of trusting it, when a page CLAIMS to be a bank we don't
// recognise, we gather real evidence from TRUSTED sources and let the AI reason
// over facts — never over its own (hallucination-prone) memory of who owns what.
//
// THREE GROUNDED CHECKS
//   1. Identify the claimed bank by matching the suspect domain against the
//      registry's keywords → resolve the bank's OFFICIAL domain (which we trust).
//   2. Cross-reference: fetch that official site and see whether it actually
//      references the suspect domain. A match is a strong "really bank-owned"
//      signal. Absence is NOT proof of guilt — a homepage won't link every
//      sub-property — so it stays "unconfirmed", never "critical".
//   3. Domain age via RDAP — brand-new domains are a classic phishing tell.
//
// SECURITY: we only ever fetch and trust the OFFICIAL registry domain — never
// the suspect page's own claims about itself (same prompt-injection threat model
// as the hidden-text scanner). The LLM is told to judge ownership ONLY from this
// retrieved evidence.

// Reverse map: keyword found in a suspect domain → the bank's official domain.
// Keywords are ordered most-specific first; the first match wins. Bare ambiguous
// tokens (e.g. "national") are deliberately omitted so NSB and NDB don't collide.
const BANK_KEYWORDS = [
  { keywords: ["boc", "bankofceylon"], officialDomain: "boc.lk",         bankName: "Bank of Ceylon" },
  { keywords: ["peoplesbank", "peoples"], officialDomain: "peoplesbank.lk", bankName: "People's Bank" },
  { keywords: ["hatton", "hnb"],       officialDomain: "hnb.lk",         bankName: "Hatton National Bank" },
  { keywords: ["sampathvishwa", "sampath"], officialDomain: "sampath.lk", bankName: "Sampath Bank" },
  { keywords: ["combank", "commercialbank"], officialDomain: "combank.lk", bankName: "Commercial Bank" },
  { keywords: ["seylan"],              officialDomain: "seylan.lk",      bankName: "Seylan Bank" },
  { keywords: ["dfcc"],                officialDomain: "dfcc.lk",        bankName: "DFCC Bank" },
  { keywords: ["panasia"],             officialDomain: "panasiabank.lk", bankName: "Pan Asia Bank" },
  { keywords: ["nsb"],                 officialDomain: "nsb.lk",         bankName: "National Savings Bank" },
  { keywords: ["ndb"],                 officialDomain: "ndb.lk",         bankName: "National Development Bank" },
]

// Newer than this → treated as a phishing-leaning age signal in the prompt.
const NEW_DOMAIN_THRESHOLD_DAYS = 90

// Free / fully-automated certificate authorities. A valid HTTPS padlock from one
// of these proves nothing about identity — anyone can get a cert for any domain
// they control in minutes — so phishing sites use them constantly. They're ALSO
// used by millions of legitimate sites, so this is only ever a WEAK signal that
// the AI must weigh, never proof of phishing.
const FREE_CAS = ["let's encrypt", "zerossl", "buypass", "cpanel", "actalis", "google trust services"]

// How long to wait on crt.sh before giving up. crt.sh is a public, sometimes-slow
// service, so we never let it stall the verdict — a timeout just yields a null CA.
const ISSUER_LOOKUP_TIMEOUT_MS = 5000

function identifyClaimedBank(domain) {
  const lower = String(domain || "").toLowerCase()
  for (const bank of BANK_KEYWORDS) {
    if (bank.keywords.some((k) => lower.includes(k))) return bank
  }
  return null
}

// The suspect's distinctive label: the SLD with TLD and separators removed.
//   "sampathvishwa.com"     → "sampathvishwa"
//   "boc-secure-login.com"  → "bocsecurelogin"
function suspectLabel(domain) {
  const sld = String(domain || "").toLowerCase().replace(/^www\./, "").split(".")[0]
  return sld.replace(/[^a-z0-9]/g, "")
}

// Does the official site reference the suspect — either by the exact domain, or
// by the suspect's distinctive label written as a product/brand name?
//
// Real banks refer to their portals by brand, not by bare domain: sampath.lk
// links its online banking as "Sampath Vishwa" / ".sampath-vishwa" / a
// ?section=Sampath-Vishwa-Retail URL, and NEVER writes "sampathvishwa.com" in the
// static HTML. So we also match the separator-stripped label against the
// separator-stripped HTML. The min-length guard keeps a short, generic label
// (e.g. just "boc") from matching boilerplate; an attacker's extra words
// ("sampathvishwa-secure" → "sampathvishwasecure") break the match.
function officialReferencesSuspect(html, suspectDomain) {
  const lowerHtml = html.toLowerCase()
  if (lowerHtml.includes(String(suspectDomain).toLowerCase())) return true
  const label = suspectLabel(suspectDomain)
  if (label.length >= 6) {
    const strippedHtml = lowerHtml.replace(/[^a-z0-9]/g, "")
    if (strippedHtml.includes(label)) return true
  }
  return false
}

// Fetch the official site and report whether it references the suspect domain.
async function crossReferenceOfficialSite(officialDomain, suspectDomain, fetchImpl) {
  const result = { officialReachable: false, suspectReferencedByOfficial: false }
  try {
    const res = await fetchImpl(`https://${officialDomain}/`, { redirect: "follow" })
    if (res && res.ok) {
      result.officialReachable = true
      const html = await res.text()
      result.suspectReferencedByOfficial = officialReferencesSuspect(html, suspectDomain)
    }
  } catch (_) {
    // Network/timeout — leave officialReachable false; the prompt will say so.
  }
  return result
}

// Look up the suspect domain's registration date via RDAP (rdap.org), returning
// its age in days, or null when unavailable.
async function lookupDomainAgeDays(suspectDomain, fetchImpl, now = Date.now()) {
  try {
    const res = await fetchImpl(`https://rdap.org/domain/${suspectDomain}`)
    if (!res || !res.ok) return null
    const data = await res.json()
    const reg = (data.events || []).find((e) => e.eventAction === "registration")
    if (reg && reg.eventDate) {
      const ageMs = now - new Date(reg.eventDate).getTime()
      if (Number.isFinite(ageMs) && ageMs >= 0) return Math.floor(ageMs / 86400000)
    }
  } catch (_) {
    // RDAP not available for this TLD / network error — caller treats as null.
  }
  return null
}

// Pull the issuing CA's organisation out of a crt.sh "issuer_name" DN string,
// e.g. "C=US, O=Let's Encrypt, CN=R3" → "Let's Encrypt". Falls back to the whole
// string when there's no O= component.
function parseIssuerOrg(issuerName) {
  const m = /O=([^,]+)/.exec(issuerName || "")
  if (m) return m[1].trim()
  const raw = String(issuerName || "").trim()
  return raw || null
}

// Look up the suspect domain's TLS issuer via Certificate Transparency logs
// (crt.sh). Chrome MV3 extensions cannot read the live certificate of a page, so
// CT logs are the practical way to learn who issued a domain's cert. Returns the
// issuing CA organisation of the most recently logged certificate, or null.
async function lookupIssuerCA(suspectDomain, fetchImpl, now = Date.now()) {
  let timer
  try {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null
    if (controller) timer = setTimeout(() => controller.abort(), ISSUER_LOOKUP_TIMEOUT_MS)
    const res = await fetchImpl(
      `https://crt.sh/?q=${encodeURIComponent(suspectDomain)}&output=json`,
      controller ? { signal: controller.signal } : undefined
    )
    if (timer) { clearTimeout(timer); timer = undefined }
    if (!res || !res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    // Most recently issued certificate wins — that's closest to what's live now.
    let best = null
    for (const entry of data) {
      const t = Date.parse(entry.not_before || entry.entry_timestamp || "")
      const score = Number.isFinite(t) ? t : -Infinity
      if (!best || score > best.score) best = { score, entry }
    }
    return best ? parseIssuerOrg(best.entry.issuer_name) : null
  } catch (_) {
    if (timer) clearTimeout(timer)
    return null
  }
}

// Main entry. Returns { grounded:false } when the page doesn't actually name a
// bank we know, otherwise an evidence object for the prompt builder.
async function groundImpersonation(suspectDomain, deps = {}) {
  const fetchImpl = deps.fetch || (typeof fetch !== "undefined" ? fetch : null)
  const now = deps.now || Date.now()
  if (!fetchImpl) return { grounded: false }

  const bank = identifyClaimedBank(suspectDomain)
  if (!bank) return { grounded: false }

  const [xref, ageDays, issuerCA] = await Promise.all([
    crossReferenceOfficialSite(bank.officialDomain, suspectDomain, fetchImpl),
    lookupDomainAgeDays(suspectDomain, fetchImpl, now),
    lookupIssuerCA(suspectDomain, fetchImpl, now),
  ])

  return {
    grounded: true,
    claimedBank: bank.bankName,
    officialDomain: bank.officialDomain,
    suspectDomain,
    officialReachable: xref.officialReachable,
    suspectReferencedByOfficial: xref.suspectReferencedByOfficial,
    suspectDomainAgeDays: ageDays,
    suspectIssuerCA: issuerCA,
  }
}

// Render the grounded evidence into prompt lines the LLM reasons over.
function groundingToPromptLines(g) {
  if (!g || !g.grounded) return []
  const lines = [
    `- The page claims to be ${g.claimedBank}, whose only official domain is "${g.officialDomain}".`,
  ]
  if (g.officialReachable) {
    lines.push(
      g.suspectReferencedByOfficial
        ? `- VERIFIED FROM TRUSTED SOURCE: the official site ${g.officialDomain} references this suspect domain, which suggests it may be a legitimate ${g.claimedBank} property.`
        : `- The official site ${g.officialDomain} does NOT reference this suspect domain. (Absence is not proof of phishing — official sites do not link every sub-property.)`
    )
  } else {
    lines.push(`- The official site ${g.officialDomain} could not be reached to cross-reference this domain.`)
  }
  if (typeof g.suspectDomainAgeDays === "number") {
    lines.push(
      g.suspectDomainAgeDays < NEW_DOMAIN_THRESHOLD_DAYS
        ? `- The suspect domain was registered only ${g.suspectDomainAgeDays} days ago — newly-registered domains are a common phishing trait.`
        : `- The suspect domain is ${g.suspectDomainAgeDays} days old, an established registration.`
    )
  }
  if (g.suspectIssuerCA) {
    const isFreeCA = FREE_CAS.some((ca) => g.suspectIssuerCA.toLowerCase().includes(ca))
    lines.push(
      isFreeCA
        ? `- The site's TLS certificate was issued by "${g.suspectIssuerCA}", a free/automatic certificate authority anyone can obtain a cert from in minutes — so a valid HTTPS padlock here does NOT prove the site is the real ${g.claimedBank}.`
        : `- The site's TLS certificate was issued by "${g.suspectIssuerCA}".`
    )
  }
  return lines
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    BANK_KEYWORDS,
    NEW_DOMAIN_THRESHOLD_DAYS,
    identifyClaimedBank,
    suspectLabel,
    officialReferencesSuspect,
    crossReferenceOfficialSite,
    lookupDomainAgeDays,
    parseIssuerOrg,
    lookupIssuerCA,
    groundImpersonation,
    groundingToPromptLines,
  }
}
