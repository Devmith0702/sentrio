// src/ai-agent/promptBuilder.js
// Builds the AI reasoning prompt from the threat signals collected by Layer 1.
// A well-crafted prompt is the most important factor in getting accurate verdicts.

function buildPrompt(threatSignals) {

  // ── Build findings list ───────────────────────────────────────────────────
  // Each triggered signal becomes a plain-English bullet the AI can reason over.
  const findings = []

  if (threatSignals.isBankImpersonation) {
    findings.push(
      `- The page claims to be "${threatSignals.bankClaimed}" bank, ` +
      `but the registered domain "${threatSignals.registeredDomain}" is NOT in the verified Sri Lankan bank domain registry.`
    )
  }

  if (threatSignals.homoglyphDetected) {
    findings.push(
      `- Homoglyph (look-alike) characters were detected in the domain name. ` +
      `These are visually identical characters from a different script (e.g. Cyrillic replacing Latin letters) ` +
      `used to trick users into thinking they are on a legitimate site.`
    )
  }

  if (threatSignals.subdomainAbuse) {
    findings.push(
      `- Subdomain abuse detected: a legitimate bank name appears as a subdomain ` +
      `rather than as the actual registered domain (e.g. boc.lk.fake-site.com).`
    )
  }

  if (threatSignals.hiddenTextFound) {
    findings.push(
      `- Hidden text was found on the page that may be a prompt injection attack targeting AI agents: ` +
      `"${threatSignals.hiddenTextContent}"`
    )
  }

  if (threatSignals.profileDeviation.detected) {
    findings.push(
      `- This site deviates from the user's personal trust profile for this domain: ` +
      `${threatSignals.profileDeviation.details}`
    )
  }

  // If no specific signals fired, note that the escalation reason is unknown
  if (findings.length === 0) {
    findings.push("- No specific signals were identified, but the page was flagged for AI review.")
  }

  const findingsList = findings.join("\n")

  // ── System prompt — defines the AI's role and output rules ────────────────
  // Strict instructions are needed so the response is always parseable JSON.
  const systemPrompt = `You are Sentrio, a cybersecurity AI agent protecting Sri Lankan internet banking users from social engineering attacks.
Your job is to analyse evidence about a suspicious website and deliver a clear, structured security verdict.

Rules you must follow:
- Respond ONLY with a valid JSON object. No explanation, no commentary, no markdown code fences.
- Do not include any text before or after the JSON.
- Your explanation must be written in simple English suitable for a non-technical Sri Lankan banking user.
- Base your verdict strictly on the evidence provided. Do not guess or assume facts not listed.`

  // ── User prompt — provides the evidence and requests the verdict ──────────
  const userPrompt = `Analyse the following suspicious website evidence and return a security verdict.

URL: ${threatSignals.url}
Registered Domain: ${threatSignals.registeredDomain}

EVIDENCE DETECTED BY LOCAL CHECKS:
${findingsList}

Respond with ONLY this JSON structure — no other text:
{
  "riskLevel": "safe|low|medium|high|critical",
  "tactic": "name of the social engineering tactic being used (e.g. Typosquatting, Authority Impersonation, Subdomain Abuse, Prompt Injection)",
  "explanation": "plain English explanation of the threat for a non-technical Sri Lankan banking user, maximum 2 sentences",
  "recommendation": "proceed|caution|leave"
}`

  return { systemPrompt, userPrompt }
}

module.exports = { buildPrompt }
