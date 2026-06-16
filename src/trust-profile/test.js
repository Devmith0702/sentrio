/**
 * SENTRIO — Trust Profile System Tests
 * Tests each module as specified in Thisaru.md
 * Uses mocks for browser APIs (IndexedDB, document, window)
 */

// ========================================================
// MOCK BROWSER APIs
// ========================================================

// In-memory store acts as IndexedDB
const mockStore = {}

const mockRequest = (result) => ({
  result,
  error: null,
  onsuccess: null,
  onerror: null,
  target: { result }
})

function triggerResult(promise, value) {
  promise._resolve(value)
  return promise
}

// Override dbSetup to use our mock
const originalDbSetup = require("./dbSetup")
const dbGetOrig = originalDbSetup.dbGet
const dbSetOrig = originalDbSetup.dbSet
const dbGetAllOrig = originalDbSetup.dbGetAll
const openDatabaseOrig = originalDbSetup.openDatabase

// Replace dbSetup functions with mock implementations
originalDbSetup.dbGet = async function(domain) {
  return mockStore[domain] ? JSON.parse(JSON.stringify(mockStore[domain])) : null
}

originalDbSetup.dbSet = async function(profile) {
  mockStore[profile.domain] = JSON.parse(JSON.stringify(profile))
  return profile.domain
}

originalDbSetup.dbGetAll = async function() {
  return Object.values(mockStore).map(v => JSON.parse(JSON.stringify(v)))
}

originalDbSetup.openDatabase = async function() {
  return { objectStoreNames: { contains: () => true } }
}

function clearDB() {
  Object.keys(mockStore).forEach(key => delete mockStore[key])
}

global.document = {
  title: "HNB Internet Banking",
  querySelectorAll: () => {
    const form = {
      closest: () => ({
        getAttribute: () => "/login"
      })
    }
    return [form]
  }
}

global.window = {
  location: {
    protocol: "https:",
    hostname: "hnb.lk",
    href: "https://hnb.lk/login"
  }
}

// ========================================================
// TEST RUNNER
// ========================================================

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ✅ ${name}`)
  } catch (err) {
    failed++
    console.log(`  ❌ ${name}: ${err.message}`)
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed")
}

function assertEqual(actual, expected, label) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${label}: expected ${e}, got ${a}`)
}

// ========================================================
// TESTS
// ========================================================

async function runTests() {
  console.log("\n=== Trust Profile System Tests ===\n")

  // --- Module: confidenceScorer ---
  console.log("\n--- confidenceScorer.js ---")

  const { calculateConfidence, isTrusted, getTrustLabel, TRUST_THRESHOLD } = require("./confidenceScorer")

  await test("TRUST_THRESHOLD is 5", () => {
    assert(TRUST_THRESHOLD === 5, "threshold should be 5")
  })

  await test("calculateConfidence returns 0 for null profile", () => {
    assert(calculateConfidence(null) === 0, "null should return 0")
  })

  await test("calculateConfidence: 0 visits, not consistent", () => {
    const score = calculateConfidence({ visitCount: 0, isConsistent: false })
    assert(score === 0, `expected 0, got ${score}`)
  })

  await test("calculateConfidence: 5 visits, consistent = 1.0", () => {
    const score = calculateConfidence({ visitCount: 5, isConsistent: true })
    assert(score === 1.0, `expected 1.0, got ${score}`)
  })

  await test("calculateConfidence: 3 visits, consistent = 0.68", () => {
    const score = calculateConfidence({ visitCount: 3, isConsistent: true })
    assert(Math.abs(score - 0.68) < 0.001, `expected ~0.68, got ${score}`)
  })

  await test("isTrusted returns false for null", () => {
    assert(isTrusted(null) === false)
  })

  await test("isTrusted returns false for 4 visits", () => {
    assert(isTrusted({ visitCount: 4 }) === false)
  })

  await test("isTrusted returns true for 5 visits", () => {
    assert(isTrusted({ visitCount: 5 }) === true)
  })

  await test("getTrustLabel: 0.95 = Highly Trusted", () => {
    assert(getTrustLabel(0.95) === "Highly Trusted")
  })

  await test("getTrustLabel: 0.7 = Trusted", () => {
    assert(getTrustLabel(0.7) === "Trusted")
  })

  await test("getTrustLabel: 0.4 = Familiar", () => {
    assert(getTrustLabel(0.4) === "Familiar")
  })

  await test("getTrustLabel: 0.1 = New", () => {
    assert(getTrustLabel(0.1) === "New")
  })

  await test("getTrustLabel: 0.0 = Unknown", () => {
    assert(getTrustLabel(0.0) === "Unknown")
  })

  // --- Module: deviationDetector ---
  console.log("\n--- deviationDetector.js ---")

  const { detectDeviation } = require("./deviationDetector")

  await test("Unknown domain — no deviation, knownDomain=false", () => {
    const result = detectDeviation({}, null)
    assertEqual(result, {
      detected: false,
      knownDomain: false,
      visitCount: 0,
      sslMismatch: false,
      formActionMismatch: false,
      details: "Domain not in trust profile — first visit"
    }, "unknown domain result")
  })

  await test("Known but not trusted (< 5 visits) — no deviation", () => {
    const stored = {
      visitCount: 3,
      fingerprint: { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB" }
    }
    const current = { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB" }
    const result = detectDeviation(current, stored)
    assert(result.detected === false, "should not detect deviation")
    assert(result.knownDomain === true, "should be known domain")
    assert(result.visitCount === 3, "visit count should be 3")
  })

  await test("Trusted domain, matching — no deviation", () => {
    const stored = {
      visitCount: 10,
      isConsistent: true,
      fingerprint: { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    }
    const current = { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    const result = detectDeviation(current, stored)
    assert(result.detected === false, "should not detect deviation")
    assert(result.details.includes("Matches trusted profile"), "should say matches")
  })

  await test("Trusted domain, form action changed — deviation detected", () => {
    const stored = {
      visitCount: 10,
      isConsistent: true,
      fingerprint: { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    }
    const current = { protocol: "https:", loginFormAction: "evil.com", pageTitle: "HNB Internet Banking" }
    const result = detectDeviation(current, stored)
    assert(result.detected === true, "should detect deviation")
    assert(result.formActionMismatch === true, "formActionMismatch should be true")
    assert(result.details.includes("evil.com"), "details should mention evil.com")
  })

  await test("Trusted domain, protocol changed — deviation detected", () => {
    const stored = {
      visitCount: 10,
      isConsistent: true,
      fingerprint: { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    }
    const current = { protocol: "http:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    const result = detectDeviation(current, stored)
    assert(result.detected === true, "should detect deviation")
    assert(result.sslMismatch === true, "sslMismatch should be true")
  })

  await test("Trusted domain, title changed — deviation detected", () => {
    const stored = {
      visitCount: 10,
      isConsistent: true,
      fingerprint: { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "HNB Internet Banking" }
    }
    const current = { protocol: "https:", loginFormAction: "hnb.lk", pageTitle: "Completely Different Title" }
    const result = detectDeviation(current, stored)
    assert(result.detected === true, "should detect deviation")
  })

  // --- Module: feedbackHandler (with mocks) ---
  console.log("\n--- feedbackHandler.js ---")

  clearDB()

  const { markAsSafe, confirmThreat } = require("./feedbackHandler")

  await test("markAsSafe creates a new profile", async () => {
    clearDB()
    await markAsSafe("test.lk", { protocol: "https:", loginFormAction: "test.lk", pageTitle: "Test" })
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("test.lk")
    assert(profile !== null, "profile should exist")
    assert(profile.domain === "test.lk", "domain should be test.lk")
    assert(profile.visitCount === 1, "visitCount should be 1")
    assert(profile.userConfirmedSafe === true, "should be confirmed safe")
    assert(profile.flaggedAsThreat === false, "should not be flagged as threat")
  })

  await test("markAsSafe increments visit count on existing profile", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "test.lk", pageTitle: "Test" }
    await markAsSafe("test.lk", fp)
    await markAsSafe("test.lk", fp)
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("test.lk")
    assert(profile.visitCount === 2, `visitCount should be 2, got ${profile.visitCount}`)
  })

  await test("confirmThreat sets flaggedAsThreat on existing profile", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "test.lk", pageTitle: "Test" }
    await markAsSafe("test.lk", fp)
    await confirmThreat("test.lk")
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("test.lk")
    assert(profile.flaggedAsThreat === true, "should be flagged as threat")
  })

  await test("confirmThreat creates new profile for unknown domain", async () => {
    clearDB()
    await confirmThreat("evil.lk")
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("evil.lk")
    assert(profile !== null, "profile should exist")
    assert(profile.flaggedAsThreat === true, "should be flagged as threat")
    assert(profile.visitCount === 0, "visitCount should be 0")
  })

  // --- Module: profileManager ---
  console.log("\n--- profileManager.js ---")

  const { getProfileDeviation, getProfileSummary } = require("./profileManager")

  await test("getProfileDeviation returns no deviation for unknown domain", async () => {
    clearDB()
    const result = await getProfileDeviation("unknown.lk")
    assert(result.detected === false, "should not detect")
    assert(result.knownDomain === false, "should be unknown")
    assert(result.details.includes("first visit"), "should say first visit")
  })

  await test("After 5 markAsSafe calls, profile is trusted", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "trusted.lk", pageTitle: "Trusted Bank" }
    for (let i = 0; i < 5; i++) {
      await markAsSafe("trusted.lk", fp)
    }
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("trusted.lk")
    assert(profile.visitCount === 5, `visitCount should be 5, got ${profile.visitCount}`)
    const { isTrusted } = require("./confidenceScorer")
    assert(isTrusted(profile) === true, "should be trusted after 5 visits")
  })

  await test("getProfileSummary returns correct structure", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "summary.lk", pageTitle: "Summary Bank" }
    for (let i = 0; i < 5; i++) {
      await markAsSafe("summary.lk", fp)
    }
    const summary = await getProfileSummary("summary.lk")
    assert(summary !== null, "summary should exist")
    assert(summary.domain === "summary.lk", "domain should match")
    assert(summary.visitCount === 5, "visitCount should be 5")
    assert(summary.isTrusted === true, "should be trusted")
    assert(summary.confidence === 1.0, "confidence should be 1.0")
    assert(summary.flaggedAsThreat === false, "should not be flagged")
  })

  await test("getProfileSummary returns null for unknown domain", async () => {
    clearDB()
    const summary = await getProfileSummary("never-seen.lk")
    assert(summary === null, "should be null for unknown domain")
  })

  // ========================================================
  // CHECKLIST VERIFICATION (from Thisaru.md)
  // ========================================================
  console.log("\n--- Checklist Verification ---")

  await test("[Checklist] getProfileDeviation() returns correct for unknown domain", async () => {
    clearDB()
    const result = await getProfileDeviation("unknown.lk")
    assert(result.detected === false)
    assert(result.knownDomain === false)
    assert(result.visitCount === 0)
    assert(result.details.includes("first visit"))
  })

  await test("[Checklist] getProfileDeviation() returns correct for known but not-yet-trusted", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "semi.lk", pageTitle: "Semi Bank" }
    await markAsSafe("semi.lk", fp)
    await markAsSafe("semi.lk", fp)
    const result = await getProfileDeviation("semi.lk")
    assert(result.detected === false)
    assert(result.knownDomain === true)
    assert(result.visitCount >= 2)
  })

  await test("[Checklist] getProfileDeviation() detects form action mismatch on trusted domain", async () => {
    clearDB()
    // Build trust first
    const fp = { protocol: "https:", loginFormAction: "real.lk", pageTitle: "Real Bank" }
    for (let i = 0; i < 5; i++) {
      await markAsSafe("real.lk", fp)
    }
    // Now change the mock DOM to simulate a fake page
    const origTitle = document.title
    const origAction = window.location.href
    document.title = "Real Bank"
    window.location.hostname = "real.lk"
    window.location.href = "https://real.lk/login"
    window.location.protocol = "https:"

    // Set the form action to a different host
    global.document.querySelectorAll = () => {
      const form = {
        closest: () => ({
          getAttribute: () => "https://evil.com/login"
        })
      }
      return [form]
    }

    const result = await getProfileDeviation("real.lk")
    assert(result.detected === true, "should detect deviation")
    assert(result.formActionMismatch === true, "formActionMismatch should be true")
  })

  await test("[Checklist] markAsSafe() increments visit count correctly", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "count.lk", pageTitle: "Count Bank" }
    await markAsSafe("count.lk", fp)
    await markAsSafe("count.lk", fp)
    await markAsSafe("count.lk", fp)
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("count.lk")
    assert(profile.visitCount === 3, `visitCount should be 3, got ${profile.visitCount}`)
  })

  await test("[Checklist] confirmThreat() sets flaggedAsThreat correctly", async () => {
    clearDB()
    await confirmThreat("evil.lk")
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("evil.lk")
    assert(profile.flaggedAsThreat === true)
  })

  await test("[Checklist] After 5 visits, isTrusted() returns true", async () => {
    clearDB()
    const fp = { protocol: "https:", loginFormAction: "trustcheck.lk", pageTitle: "Trust Check" }
    for (let i = 0; i < 5; i++) {
      await markAsSafe("trustcheck.lk", fp)
    }
    const { dbGet } = require("./dbSetup")
    const profile = await dbGet("trustcheck.lk")
    const { isTrusted } = require("./confidenceScorer")
    assert(isTrusted(profile) === true)
  })

  await test("[Checklist] No crash when IndexedDB is unavailable (fail safe)", async () => {
    // Temporarily make dbGet throw to simulate IndexedDB failure
    const origDbGet = originalDbSetup.dbGet
    originalDbSetup.dbGet = async () => { throw new Error("IndexedDB unavailable") }

    try {
      // Re-require profileManager to pick up the broken dbGet
      delete require.cache[require.resolve("./profileManager")]
      const { getProfileDeviation: brokenGet } = require("./profileManager")
      const result = await brokenGet("crash-test.lk")
      assert(result.detected === false, "should return safe default")
      assert(result.details === "Trust profile unavailable", `should say unavailable, got: ${result.details}`)
    } finally {
      originalDbSetup.dbGet = origDbGet
      // Restore clean profileManager
      delete require.cache[require.resolve("./profileManager")]
      delete require.cache[require.resolve("./feedbackHandler")]
      delete require.cache[require.resolve("./deviationDetector")]
    }
  })

  // ========================================================
  // SUMMARY
  // ========================================================
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

const origTimeout = setTimeout
setTimeout(() => {
  runTests().catch(err => {
    console.error("Test suite error:", err)
    process.exit(1)
  })
}, 50)
