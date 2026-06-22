// background.js — Sentrio service worker (Layer 2 host)
//
// MV3 service workers can't require() the CommonJS ai-agent modules, so the
// Layer 2 logic (prompt → Groq → verdict) is inlined here. It mirrors
// src/ai-agent/* (which remain the tested source of truth for Node).
//
// Flow:
//   content.js  --ANALYSE_THREAT-->  background  --(Groq)-->  --SHOW_VERDICT-->  overlay
//   content.js  --PAGE_SAFE------->  background  ------------>  --SHOW_SAFE----->  overlay

// API key + provider settings come from the gitignored config (not committed here).
importScripts("src/ai-agent/config.js")
// Layer 2.5 grounding. grounding.js has NO internal require()s, so importing it
// here exposes its functions (groundImpersonation, groundingToPromptLines) as
// worker globals directly — no inline mirror needed.
importScripts("src/ai-agent/grounding.js")
// config.js declares its own top-level `const CONFIG`, which shares global scope
// with this worker via importScripts — so we read it under a different name.
const CFG = self.SENTRIO_CONFIG

const VALID_RISK = ["safe", "low", "medium", "high", "critical"]
const VALID_REC  = ["proceed", "caution", "leave"]

// ── Prompt builder (mirrors src/ai-agent/promptBuilder.js) ──────────────────
// `grounding` is the optional evidence object from groundImpersonation().
function buildPrompt(s, grounding) {
  const findings = []
  if (s.isBankImpersonation)
    findings.push(`- The page claims to be "${s.bankClaimed}" but the registered domain "${s.registeredDomain}" is NOT in the verified Sri Lankan bank registry.`)
  if (s.homoglyphDetected)
    findings.push(`- Look-alike (homoglyph) characters were detected in the domain, used to mimic a legitimate bank.`)
  if (s.subdomainAbuse)
    findings.push(`- Subdomain abuse: a real bank name appears as a subdomain of an unrelated domain (e.g. boc.lk.fake.com).`)
  if (s.hiddenTextFound)
    findings.push(`- Hidden text that may be a prompt-injection attack was found: "${s.hiddenTextContent}"`)
  if (s.suspiciousFormActions && s.suspiciousFormActions.length)
    findings.push(`- A login form submits to an external domain: ${s.suspiciousFormActions.map(f => f.action).join(", ")}`)
  if (s.profileDeviation && s.profileDeviation.detected)
    findings.push(`- This site deviates from the user's trusted profile: ${s.profileDeviation.details}`)

  // Grounded evidence retrieved from trusted sources (official site + RDAP).
  for (const line of groundingToPromptLines(grounding)) findings.push(line)

  if (!findings.length)
    findings.push("- No specific signal identified, but the page was flagged for review.")

  const systemPrompt =
    `You are Sentrio, a cybersecurity AI protecting Sri Lankan internet-banking users.\n` +
    `Analyse the evidence and return a security verdict.\n` +
    `Rules: respond with ONLY a valid JSON object, no markdown, no commentary. ` +
    `Write the explanation in simple English for a non-technical user. ` +
    `Base the verdict strictly on the evidence given. ` +
    `IMPORTANT: when judging whether a domain belongs to a bank, rely ONLY on the ` +
    `retrieved evidence above (official-site cross-reference, domain age). Do NOT ` +
    `use your own memory of which domains belong to which banks — it may be wrong. ` +
    `If the official site verifiably references the domain, lower the risk; if the ` +
    `domain is newly registered and unverified, raise it.`

  const userPrompt =
    `Analyse this suspicious website and return a verdict.\n\n` +
    `URL: ${s.url}\nRegistered Domain: ${s.registeredDomain}\n\nEVIDENCE:\n${findings.join("\n")}\n\n` +
    `Respond with ONLY this JSON:\n` +
    `{"riskLevel":"safe|low|medium|high|critical","tactic":"social-engineering tactic name",` +
    `"explanation":"max 2 sentences, plain English","recommendation":"proceed|caution|leave"}`

  return { systemPrompt, userPrompt }
}

// ── Groq call (mirrors src/ai-agent/apiClient.js) ───────────────────────────
async function callGroq(systemPrompt, userPrompt) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CFG.TIMEOUT_MS)
  try {
    const res = await fetch(CFG.GROQ_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${CFG.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: CFG.GROQ_MODEL,
        max_tokens: CFG.MAX_TOKENS,
        temperature: 0.1,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]
      }),
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`)
    const data = await res.json()
    return data.choices[0].message.content
  } catch (e) {
    clearTimeout(timer)
    throw e.name === "AbortError" ? new Error("API request timed out") : e
  }
}

// ── Response parser (mirrors src/ai-agent/responseParser.js) ────────────────
function parseResponse(raw) {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
  const parsed = JSON.parse(cleaned)
  for (const f of ["riskLevel", "tactic", "explanation", "recommendation"]) {
    if (!parsed[f] || typeof parsed[f] !== "string" || !parsed[f].trim())
      throw new Error(`Missing field: ${f}`)
  }
  if (!VALID_RISK.includes(parsed.riskLevel)) throw new Error(`Bad riskLevel ${parsed.riskLevel}`)
  if (!VALID_REC.includes(parsed.recommendation)) throw new Error(`Bad recommendation ${parsed.recommendation}`)
  return {
    riskLevel: parsed.riskLevel,
    tactic: parsed.tactic.trim(),
    explanation: parsed.explanation.trim(),
    recommendation: parsed.recommendation,
    confidence: "high"
  }
}

function fallbackVerdict() {
  return {
    riskLevel: "medium", tactic: "Unknown",
    explanation: "Sentrio could not analyse this page. Proceed with caution.",
    recommendation: "caution", confidence: "low", isFallback: true
  }
}

async function analyseThreats(signals) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fallbackVerdict()
  try {
    // Only spend grounding fetches when the page actually claims to be a bank we
    // can't verify — that's the case the registry gets wrong. Failures inside
    // groundImpersonation are swallowed there and just yield {grounded:false}.
    let grounding = null
    if (signals.isBankImpersonation) {
      grounding = await groundImpersonation(signals.registeredDomain)
      console.log("Sentrio: grounding evidence", grounding)
    }
    const { systemPrompt, userPrompt } = buildPrompt(signals, grounding)
    const raw = await callGroq(systemPrompt, userPrompt)
    return parseResponse(raw)
  } catch (e) {
    console.warn("Sentrio: AI analysis failed —", e.message)
    return fallbackVerdict()
  }
}

// ── Message router ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id

  if (message.type === "ANALYSE_THREAT") {
    console.log("Sentrio: threat signals received", message.payload)
    analyseThreats(message.payload).then(verdict => {
      console.log("Sentrio: AI verdict", verdict)
      if (tabId != null) {
        chrome.tabs.sendMessage(tabId, { type: "SHOW_VERDICT", payload: verdict }, () => void chrome.runtime.lastError)
      }
    })
    return true   // keep the message channel open for the async Groq call
  }

  if (message.type === "PAGE_SAFE") {
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: "SHOW_SAFE", payload: message.payload }, () => void chrome.runtime.lastError)
    }
  }

  if (message.type === "MARK_SAFE") {
    console.log("Sentrio: user marked safe —", message.payload && message.payload.domain)
  }

  if (message.type === "CONFIRM_THREAT") {
    console.log("Sentrio: user confirmed threat —", message.payload && message.payload.domain)
  }
})
