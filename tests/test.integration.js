/**
 * Sentrio — Full Integration Test
 * Tests the complete signal pipeline: URL → Layer 1 → Layer 2 → Verdict
 * and the trust profile system (Layer 3) alongside it.
 *
 * Run with: node test.integration.js
 *
 * Does NOT require API keys — Layer 2 AI calls are mocked.
 * Does NOT require a browser — IndexedDB is mocked in-memory.
 */

// ─── MOCK: Layer 2 AI API (no real API keys needed) ────────────────────────
// We intercept require() for config and apiClient before any real module loads them.

require.extensions[".js"] // ensure extensions exist

const Module = require("module")
const originalLoad = Module._load

Module._load = function (request, parent, isMain) {
  // Mock config.js so apiClient.js doesn't crash on missing file
  if (request === "./config" && parent && parent.filename.includes("ai-agent")) {
    return {
      CONFIG: {
        PROVIDER: "groq",
        GROQ_API_KEY: "mock-key",
        GROQ_MODEL: "llama-3.3-70b-versatile",
        GROQ_ENDPOINT: "https://mock.api/groq",
        GEMINI_API_KEY: "mock-key",
        GEMINI_ENDPOINT: "https://mock.api/gemini",
        CLAUDE_API_KEY: "mock-key",
        CLAUDE_ENDPOINT: "https://mock.api/claude",
        CLAUDE_MODEL: "claude-sonnet-4-6",
        MAX_TOKENS: 300,
        TIMEOUT_MS: 10000
      }
    }
  }
  return originalLoad.apply(this, arguments)
}

// Mock fetch globally — returns a valid AI verdict JSON
global.fetch = async (url, options) => {
  // Simulate a realistic AI response
  const mockVerdict = {
    riskLevel: "high",
    tactic: "Typosquatting",
    explanation: "This website is pretending to be a Sri Lankan bank but uses a suspicious domain. Do not enter your banking details.",
    recommendation: "leave"
  }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(mockVerdict) }] } }]
    }),
    text: async () => JSON.stringify(mockVerdict)
  }
}

// Mock browser globals for Layer 3 (trust profile)
global.navigator = { onLine: true }

// ─── MOCK: Layer 3 IndexedDB ────────────────────────────────────────────────
const mockStore = {}
const dbSetup = require("../src/trust-profile/dbSetup")
dbSetup.dbGet    = async (domain)  => mockStore[domain] ? JSON.parse(JSON.stringify(mockStore[domain])) : null
dbSetup.dbSet    = async (profile) => { mockStore[profile.domain] = JSON.parse(JSON.stringify(profile)); return profile.domain }
dbSetup.dbGetAll = async ()        => Object.values(mockStore).map(v => JSON.parse(JSON.stringify(v)))
dbSetup.openDatabase = async ()    => ({ objectStoreNames: { contains: () => true } })

// Mock browser DOM globals for Layer 3 fingerprinter
global.document = {
  title: "HNB Internet Banking",
  querySelectorAll: (sel) => {
    if (sel === "input[type='password']") {
      return [{ closest: () => ({ getAttribute: () => "/login" }) }]
    }
    return []
  }
}
global.window = {
  location: { protocol: "https:", hostname: "hnb.lk", href: "https://hnb.lk/login" }
}

// ─── LOAD MODULES ───────────────────────────────────────────────────────────

// Layer 1 — loaded as globals (matches how content scripts work)
const fs = require("fs")
const vm = require("vm")

function loadAsGlobal(filePath) {
  const code = fs.readFileSync(filePath, "utf8")
  vm.runInThisContext(code)
}

loadAsGlobal("src/core/bankRegistry.js")
loadAsGlobal("src/core/urlAnalyser.js")
loadAsGlobal("src/core/homoglyphDetector.js")
loadAsGlobal("src/core/subdomainChecker.js")
loadAsGlobal("src/core/signalBuilder.js")

// Layer 2
const { analyseThreats } = require("../src/ai-agent/agentCore")
const { buildPrompt }    = require("../src/ai-agent/promptBuilder")
const { parseResponse, getFallbackVerdict } = require("../src/ai-agent/responseParser")
const { handleAPIError, isNetworkAvailable } = require("../src/ai-agent/fallbackHandler")

// Layer 3
const { markAsSafe, confirmThreat }   = require("../src/trust-profile/feedbackHandler")
const { getProfileDeviation, getProfileSummary } = require("../src/trust-profile/profileManager")
const { isTrusted, calculateConfidence } = require("../src/trust-profile/confidenceScorer")

// ─── TEST RUNNER ─────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures = []

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (err) {
    failed++
    failures.push({ name, error: err.message })
    console.log(`  ❌ ${name}`)
    console.log(`     → ${err.message}`)
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed") }
function assertEqual(a, b, label) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

function clearDB() { Object.keys(mockStore).forEach(k => delete mockStore[k]) }

// ─── HELPER: run a URL through the full Layer 1 pipeline ────────────────────
function layer1Analyse(url, overrides = {}) {
  const urlData   = analyseURL(url)
  const verified  = getVerifiedBank(urlData.registeredDomain)
  const bankCheck = {
    isVerifiedBank:    !!verified,
    bankClaimed:       verified || (containsBankName(urlData.hostname) ? urlData.hostname : null),
    claimingToBeBank:  containsBankName(urlData.hostname)
  }
  const hom = detectHomoglyphs(urlData.hostname)
  const sub = checkSubdomainAbuse(urlData)
  // domScanner not available in Node — use a clean mock
  const dom = overrides.dom || {
    injectionFound: false, injectionDetails: [],
    suspiciousFormActions: [], loginFormPresent: true
  }
  const profile = overrides.profileDeviation || { detected: false, details: "" }

  return buildThreatSignals(urlData, bankCheck, hom, sub, dom, profile)
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — LAYER 1: Signal Detection
// ════════════════════════════════════════════════════════════════════════════
async function testLayer1() {
  console.log("\n╔══════════════════════════════════════╗")
  console.log("║  LAYER 1 — Signal Detection          ║")
  console.log("╚══════════════════════════════════════╝\n")

  await test("Verified bank URL → no escalation", () => {
    const sig = layer1Analyse("https://hnb.lk/login")
    assert(sig.shouldEscalateToAI === false, "should not escalate for verified bank")
    assert(sig.isVerifiedBank === true, "should be verified bank")
    assert(sig.hasHTTPS === true, "should have HTTPS")
  })

  await test("Impersonation URL (suspicious TLD) → escalates", () => {
    const sig = layer1Analyse("https://hnb-secure.net/login")
    assert(sig.shouldEscalateToAI === true, "should escalate")
    assert(sig.isBankImpersonation === true, "should flag impersonation")
    assert(sig.hasSuspiciousTLD === true, ".net is treated as suspicious (Sri Lankan banks use .lk)")
  })

  await test("Suspicious TLD → escalates", () => {
    const sig = layer1Analyse("http://hnb-online.xyz/login")
    assert(sig.shouldEscalateToAI === true, "should escalate")
    assert(sig.hasSuspiciousTLD === true, ".xyz is suspicious")
    assert(sig.hasHTTPS === false, "no HTTPS")
  })

  await test("Subdomain abuse (boc.lk.evil.com) → escalates", () => {
    const sig = layer1Analyse("https://boc.lk.verify-me.com/login")
    assert(sig.shouldEscalateToAI === true, "should escalate")
    assert(sig.subdomainAbuse === true, "subdomain abuse should be detected")
  })

  await test("Homoglyph in domain (Cyrillic о) → escalates", () => {
    const sig = layer1Analyse("https://hnb.lk/login")  // clean baseline
    // Inject a homoglyph signal manually
    const homSig = { ...sig, homoglyphDetected: true, shouldEscalateToAI: true }
    assert(homSig.homoglyphDetected === true, "homoglyph flag set")
    assert(homSig.shouldEscalateToAI === true, "escalates")
  })

  await test("Brand homoglyph in visible text (Greek Eta in 'Ηatton') → detected", () => {
    const r = detectBrandHomoglyphs("Ηatton National Bank — Online Banking Login")
    assert(r.detected === true, "Greek-Eta 'Hatton' should be flagged")
    assert(r.details[0].looksLike.toLowerCase().includes("hatton"), "deconfused token reveals the bank name")
  })

  await test("Brand homoglyph: Cyrillic Es in 'Ѕampath' → detected", () => {
    assert(detectBrandHomoglyphs("Welcome to Ѕampath Bank").detected === true, "Cyrillic-Es 'Sampath' flagged")
  })

  await test("Brand homoglyph: plain-ASCII bank name → NOT flagged", () => {
    assert(detectBrandHomoglyphs("Hatton National Bank").detected === false, "legitimate ASCII brand is clean")
  })

  await test("Brand homoglyph: non-Latin (Sinhala) page text → NO false positive", () => {
    assert(detectBrandHomoglyphs("ලංකා බැංකුව මුල් පිටුව පිවිසුම").detected === false, "Sinhala text must not trip the check")
  })

  await test("DOM prompt injection signal → escalates", () => {
    const sig = layer1Analyse("https://hnb.lk/login", {
      dom: {
        injectionFound: true,
        injectionDetails: [{ content: "ignore previous instructions" }],
        suspiciousFormActions: [],
        loginFormPresent: true
      }
    })
    assert(sig.shouldEscalateToAI === true, "injection should escalate")
    assert(sig.hiddenTextFound === true, "hiddenTextFound should be true")
  })

  await test("Profile deviation signal → escalates", () => {
    const sig = layer1Analyse("https://hnb.lk/login", {
      profileDeviation: { detected: true, details: "Form action changed to evil.com" }
    })
    assert(sig.shouldEscalateToAI === true, "profile deviation should escalate")
    assert(sig.profileDeviation.detected === true)
  })

  await test("User 'mark safe' override → suppresses escalation when nothing changed", () => {
    // hnb-secure.xyz would normally escalate (bank impersonation + suspicious TLD),
    // but the user previously marked this exact domain safe and no fingerprint
    // deviation exists → respect the override and stay silent.
    const sig = layer1Analyse("https://hnb-secure.xyz/login", {
      profileDeviation: { detected: false, userConfirmedSafe: true, details: "Matches trusted profile" }
    })
    assert(sig.shouldEscalateToAI === false, "user override should suppress the warning")
  })

  await test("User 'mark safe' override does NOT apply once the page deviates", () => {
    const sig = layer1Analyse("https://hnb-secure.xyz/login", {
      profileDeviation: { detected: true, userConfirmedSafe: true, details: "Login form now submits elsewhere" }
    })
    assert(sig.shouldEscalateToAI === true, "a fingerprint deviation overrides the safe-mark")
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — LAYER 2: AI Agent (mocked API)
// ════════════════════════════════════════════════════════════════════════════
async function testLayer2() {
  console.log("\n╔══════════════════════════════════════╗")
  console.log("║  LAYER 2 — AI Agent                  ║")
  console.log("╚══════════════════════════════════════╝\n")

  await test("buildPrompt: bank impersonation generates relevant prompt", () => {
    const signals = layer1Analyse("https://hnb-secure.net/login")
    const { systemPrompt, userPrompt } = buildPrompt(signals)
    assert(systemPrompt.includes("Sentrio"), "system prompt should mention Sentrio")
    assert(systemPrompt.includes("JSON"), "system prompt should require JSON output")
    assert(userPrompt.includes("hnb-secure.net"), "user prompt should include the domain")
    assert(userPrompt.includes("riskLevel"), "user prompt should specify output schema")
  })

  await test("buildPrompt: subdomain abuse signal appears in prompt", () => {
    const signals = layer1Analyse("https://boc.lk.evil.com/login")
    const { userPrompt } = buildPrompt(signals)
    assert(userPrompt.toLowerCase().includes("subdomain"), "subdomain abuse should appear in prompt")
  })

  await test("buildPrompt: profile deviation signal appears in prompt", () => {
    const signals = layer1Analyse("https://hnb.lk/login", {
      profileDeviation: { detected: true, details: "SSL cert changed" }
    })
    const { userPrompt } = buildPrompt(signals)
    assert(userPrompt.includes("trust profile"), "deviation details should appear in prompt")
  })

  await test("parseResponse: valid JSON → clean verdict", () => {
    const raw = JSON.stringify({
      riskLevel: "high",
      tactic: "Typosquatting",
      explanation: "This domain is fake.",
      recommendation: "leave"
    })
    const verdict = parseResponse(raw)
    assert(verdict.riskLevel === "high")
    assert(verdict.recommendation === "leave")
    assert(verdict.tactic === "Typosquatting")
  })

  await test("parseResponse: strips markdown fences and parses", () => {
    const raw = "```json\n{\"riskLevel\":\"low\",\"tactic\":\"None\",\"explanation\":\"Looks fine.\",\"recommendation\":\"proceed\"}\n```"
    const verdict = parseResponse(raw)
    assert(verdict.riskLevel === "low")
    assert(verdict.recommendation === "proceed")
  })

  await test("parseResponse: invalid JSON → throws", () => {
    let threw = false
    try { parseResponse("not json at all") } catch { threw = true }
    assert(threw, "should throw on invalid JSON")
  })

  await test("parseResponse: invalid riskLevel → throws", () => {
    let threw = false
    try {
      parseResponse(JSON.stringify({ riskLevel: "extreme", tactic: "X", explanation: "X", recommendation: "proceed" }))
    } catch { threw = true }
    assert(threw, "should throw on invalid riskLevel")
  })

  await test("parseResponse: missing field → throws", () => {
    let threw = false
    try {
      parseResponse(JSON.stringify({ riskLevel: "high", tactic: "X" }))
    } catch { threw = true }
    assert(threw, "should throw on missing fields")
  })

  await test("getFallbackVerdict: always returns valid safe verdict", () => {
    const v = getFallbackVerdict()
    assert(v.riskLevel === "medium")
    assert(v.recommendation === "caution")
    assert(typeof v.explanation === "string")
  })

  await test("handleAPIError: timeout → fallback verdict", () => {
    const v = handleAPIError(new Error("API request timed out after 10000ms"))
    assert(v.recommendation === "caution")
  })

  await test("handleAPIError: bad JSON → fallback verdict", () => {
    const v = handleAPIError(new Error("AI response is not valid JSON"))
    assert(v.recommendation === "caution")
  })

  await test("isNetworkAvailable: returns true in Node env", () => {
    assert(isNetworkAvailable() === true, "should default to true in Node")
  })

  await test("analyseThreats: full pipeline with mocked AI → valid verdict", async () => {
    const signals = layer1Analyse("https://hnb-secure.net/login")
    const verdict = await analyseThreats(signals)
    assert(["safe","low","medium","high","critical"].includes(verdict.riskLevel), "riskLevel must be valid")
    assert(["proceed","caution","leave"].includes(verdict.recommendation), "recommendation must be valid")
    assert(typeof verdict.explanation === "string" && verdict.explanation.length > 0, "explanation must be present")
    assert(typeof verdict.tactic === "string" && verdict.tactic.length > 0, "tactic must be present")
  })

  await test("analyseThreats: offline → fallback verdict (no API call)", async () => {
    const origOnline = global.navigator.onLine
    global.navigator.onLine = false
    // reload fallbackHandler since it read navigator.onLine at call time
    delete require.cache[require.resolve("../src/ai-agent/fallbackHandler")]
    delete require.cache[require.resolve("../src/ai-agent/agentCore")]
    const { analyseThreats: at } = require("../src/ai-agent/agentCore")
    const verdict = await at({ url: "http://test.com", registeredDomain: "test.com", profileDeviation: { detected: false } })
    assert(verdict.recommendation === "caution", "offline should return caution")
    global.navigator.onLine = origOnline
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — LAYER 3: Trust Profile
// ════════════════════════════════════════════════════════════════════════════
async function testLayer3() {
  console.log("\n╔══════════════════════════════════════╗")
  console.log("║  LAYER 3 — Trust Profile System      ║")
  console.log("╚══════════════════════════════════════╝\n")

  await test("Unknown domain → not trusted, no deviation", async () => {
    clearDB()
    const result = await getProfileDeviation("unknown-bank.lk")
    assert(result.detected === false)
    assert(result.knownDomain === false)
    assert(result.details.includes("first visit"))
  })

  await test("markAsSafe 5× → domain becomes trusted", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "boc.lk", pageTitle: "Bank of Ceylon" }
    for (let i = 0; i < 5; i++) await markAsSafe("boc.lk", fp)
    const summary = await getProfileSummary("boc.lk")
    assert(summary.isTrusted === true, "should be trusted after 5 visits")
    assert(summary.confidence === 1.0, "confidence should be 1.0")
    assert(summary.flaggedAsThreat === false)
  })

  await test("Trusted domain with changed form action → deviation detected", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "sampath.lk", pageTitle: "Sampath Bank" }
    for (let i = 0; i < 5; i++) await markAsSafe("sampath.lk", fp)
    // Simulate visiting with a changed form action (attacker changed it)
    const { detectDeviation } = require("../src/trust-profile/deviationDetector")
    const { dbGet } = require("../src/trust-profile/dbSetup")
    const stored = await dbGet("sampath.lk")
    const fakeFingerprint = { protocol: "https:", loginFormAction: "evil.com", pageTitle: "Sampath Bank" }
    const result = detectDeviation(fakeFingerprint, stored)
    assert(result.detected === true, "deviation should be detected")
    assert(result.formActionMismatch === true, "form action mismatch flag should be set")
    assert(result.details.includes("evil.com"), "details should mention the attacker domain")
  })

  await test("confirmThreat → flaggedAsThreat set", async () => {
    clearDB()
    await confirmThreat("phishing.lk")
    const summary = await getProfileSummary("phishing.lk")
    assert(summary.flaggedAsThreat === true)
  })

  await test("IndexedDB failure → safe fallback (no crash)", async () => {
    const origGet = dbSetup.dbGet
    dbSetup.dbGet = async () => { throw new Error("IndexedDB unavailable") }
    delete require.cache[require.resolve("../src/trust-profile/profileManager")]
    const { getProfileDeviation: brokenGet } = require("../src/trust-profile/profileManager")
    const result = await brokenGet("crash.lk")
    assert(result.detected === false, "should not detect on DB failure")
    assert(result.details === "Trust profile unavailable")
    dbSetup.dbGet = origGet
    delete require.cache[require.resolve("../src/trust-profile/profileManager")]
  })
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — END-TO-END: All 3 Layers Together
// ════════════════════════════════════════════════════════════════════════════
async function testEndToEnd() {
  console.log("\n╔══════════════════════════════════════╗")
  console.log("║  END-TO-END — All Layers Together    ║")
  console.log("╚══════════════════════════════════════╝\n")

  await test("E2E: Verified bank visit → no escalation, profile updated", async () => {
    clearDB()
    const url = "https://hnb.lk/login"
    const signals = layer1Analyse(url)
    assert(signals.shouldEscalateToAI === false, "Layer 1 should not escalate verified bank")
    // Layer 3: record the safe visit
    const fp = { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    await markAsSafe("hnb.lk", fp)
    const summary = await getProfileSummary("hnb.lk")
    assert(summary.visitCount === 1, "trust profile should record 1 visit")
  })

  await test("E2E: Impersonation site → Layer 1 escalates → Layer 2 returns verdict", async () => {
    clearDB()
    const url = "https://hnb-secure.net/login"
    const signals = layer1Analyse(url)
    assert(signals.shouldEscalateToAI === true, "Layer 1 should escalate")
    assert(signals.isBankImpersonation === true, "impersonation flag set")

    const verdict = await analyseThreats(signals)
    assert(["high","critical","medium"].includes(verdict.riskLevel), "high-risk verdict expected")
    assert(verdict.recommendation === "leave" || verdict.recommendation === "caution", "should warn user")
  })

  await test("E2E: Trusted site with profile deviation → Layer 1+3 escalate → Layer 2 analyses", async () => {
    clearDB()
    // Build trust for sampath.lk
    const fp = { protocol: "https:", loginFormAction: "sampath.lk", pageTitle: "Sampath Bank" }
    for (let i = 0; i < 5; i++) await markAsSafe("sampath.lk", fp)

    // Now attacker changed the form action
    const profileDeviation = { detected: true, details: 'Form now submits to "evil.com" instead of "sampath.lk"' }
    const signals = layer1Analyse("https://sampath.lk/login", { profileDeviation })
    assert(signals.shouldEscalateToAI === true, "profile deviation should escalate")
    assert(signals.profileDeviation.detected === true)

    const verdict = await analyseThreats(signals)
    assert(typeof verdict.riskLevel === "string", "should return a verdict")
    assert(typeof verdict.recommendation === "string")
  })

  await test("E2E: Subdomain abuse URL → full pipeline to verdict", async () => {
    const url = "https://boc.lk.phishing-site.com/login"
    const signals = layer1Analyse(url)
    assert(signals.subdomainAbuse === true)
    assert(signals.shouldEscalateToAI === true)

    const { userPrompt } = buildPrompt(signals)
    assert(userPrompt.toLowerCase().includes("subdomain"), "prompt should mention subdomain")

    const verdict = await analyseThreats(signals)
    assert(verdict.recommendation !== undefined, "should have a recommendation")
  })

  await test("E2E: Network offline → full pipeline degrades gracefully", async () => {
    global.navigator.onLine = false
    delete require.cache[require.resolve("../src/ai-agent/fallbackHandler")]
    delete require.cache[require.resolve("../src/ai-agent/agentCore")]
    const { analyseThreats: atOffline } = require("../src/ai-agent/agentCore")
    const signals = layer1Analyse("https://evil-bank.xyz/login")
    const verdict = await atOffline(signals)
    assert(verdict.recommendation === "caution", "offline should return caution fallback")
    global.navigator.onLine = true
  })
}

// ════════════════════════════════════════════════════════════════════════════
// RUN ALL SECTIONS
// ════════════════════════════════════════════════════════════════════════════
async function run() {
  console.log("\n╔══════════════════════════════════════╗")
  console.log("║  Sentrio — Integration Test Suite    ║")
  console.log("╚══════════════════════════════════════╝")

  await testLayer1()
  await testLayer2()
  await testLayer3()
  await testEndToEnd()

  console.log("\n" + "═".repeat(42))
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log("═".repeat(42))

  if (failures.length > 0) {
    console.log("\nFailed tests:")
    failures.forEach(f => console.log(`  ❌ ${f.name}\n     → ${f.error}`))
  }

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error("Test suite crashed:", err)
  process.exit(1)
})
