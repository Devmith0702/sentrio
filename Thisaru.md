# Sentrio — Person 3
## Personal Trust Profile System + Layer 3: Learning & Feedback

---

## What You Are Building

You are building Sentrio's **memory** — the feature that makes it smarter the more someone uses it. While other security tools treat every visit the same, yours learns what *this specific user's* real bank sites look like.

After a user visits their real HNB Bank 5 times, your system has built a fingerprint of it. The next time something claims to be HNB, your system checks — does it match what we've seen before? If not, that's a red flag specific to this user.

Your responsibilities:
1. Store a fingerprint of every legitimate site the user visits
2. Compare new visits against stored fingerprints
3. Detect deviations — SSL changed, form submits somewhere new, etc.
4. Export a `profileDeviation` object that Person 1 includes in their threat signals
5. Update profiles based on user feedback (when user clicks "Mark as safe" or "Confirm threat")

---

## Your Folder

Work exclusively inside:
```
src/trust-profile/
```

---

## Files You Need to Create

```
src/
└── trust-profile/
    ├── profileManager.js      ← Main entry point — get/set/update profiles
    ├── dbSetup.js             ← IndexedDB initialisation and schema
    ├── fingerprinter.js       ← Extracts fingerprint from current page
    ├── deviationDetector.js   ← Compares current visit vs stored profile
    ├── confidenceScorer.js    ← Calculates how trusted a domain is
    └── feedbackHandler.js     ← Handles "Mark as safe" / "Confirm threat"
```

---

## Step-by-Step: What to Build

---

### Step 1 — dbSetup.js

Sets up the IndexedDB database. IndexedDB is a browser-native key-value store — it lives entirely on the user's device, never sent anywhere.

```javascript
// src/trust-profile/dbSetup.js

const DB_NAME = "sentrio_trust_profiles"
const DB_VERSION = 1
const STORE_NAME = "profiles"

// Opens (or creates) the database
function openDatabase() {
  return new Promise((resolve, reject) => {

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    // Called when database is first created or version changes
    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Create the profiles store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "domain" })

        // Create indexes for fast lookups
        store.createIndex("domain", "domain", { unique: true })
        store.createIndex("visitCount", "visitCount", { unique: false })
        store.createIndex("lastVisited", "lastVisited", { unique: false })

        console.log("Sentrio: Trust profile database created")
      }
    }

    request.onsuccess = (event) => resolve(event.target.result)
    request.onerror = (event) => reject(event.target.error)
  })
}

// Generic get from database
async function dbGet(domain) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(domain)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// Generic set to database
async function dbSet(profile) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    const store = tx.objectStore(STORE_NAME)
    const request = store.put(profile)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Get all profiles
async function dbGetAll() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

module.exports = { openDatabase, dbGet, dbSet, dbGetAll, STORE_NAME }
```

---

### Step 2 — fingerprinter.js

Extracts a fingerprint from the current page. This is what gets stored and compared later.

```javascript
// src/trust-profile/fingerprinter.js

// Extracts fingerprint data from a page visit
// This runs in the context of the content script (has access to DOM)
function extractFingerprint() {

  // Get SSL certificate info
  // Note: Chrome extensions can access certificate info via chrome.tabs API
  // For now we extract what we can from the page itself
  const sslIssuer = extractSSLInfo()

  // Get login form action URL
  const loginFormAction = extractLoginFormAction()

  // Get page title pattern (real banks have consistent titles)
  const pageTitle = document.title

  // Record session start time to calculate session duration later
  const sessionStart = Date.now()

  return {
    sslIssuer,
    loginFormAction,
    pageTitle,
    sessionStart,
    protocol: window.location.protocol,
    hostname: window.location.hostname
  }
}

// Try to get SSL issuer from page (limited in content scripts)
function extractSSLInfo() {
  // Chrome content scripts cannot directly access SSL cert details
  // We approximate by checking if HTTPS is used and the domain structure
  return {
    usesHTTPS: window.location.protocol === "https:",
    // Full SSL details come from background.js via chrome.tabs API
    issuer: null  // Will be populated by background.js
  }
}

// Get where the login form submits to
function extractLoginFormAction() {
  const passwordInputs = document.querySelectorAll("input[type='password']")
  if (passwordInputs.length === 0) return null

  // Find the form containing the password input
  const form = passwordInputs[0].closest("form")
  if (!form) return null

  const action = form.getAttribute("action")
  if (!action) return window.location.hostname  // Default: same domain

  // Resolve relative URLs to absolute
  try {
    const resolved = new URL(action, window.location.href)
    return resolved.hostname
  } catch {
    return action
  }
}

module.exports = { extractFingerprint }
```

---

### Step 3 — confidenceScorer.js

Calculates how much we trust a domain based on visit history.

```javascript
// src/trust-profile/confidenceScorer.js

// Minimum visits before a domain is "trusted"
const TRUST_THRESHOLD = 5

// Calculate confidence score (0.0 to 1.0)
function calculateConfidence(profile) {
  if (!profile) return 0

  // Base score from visit count
  // 0 visits = 0.0, 5+ visits = 0.8 max from visits alone
  const visitScore = Math.min(profile.visitCount / TRUST_THRESHOLD, 1.0) * 0.8

  // Bonus for consistency — did SSL and form action stay the same?
  const consistencyBonus = profile.isConsistent ? 0.2 : 0.0

  const score = visitScore + consistencyBonus

  return Math.min(score, 1.0)
}

// Is this domain trusted enough to use as a baseline?
function isTrusted(profile) {
  if (!profile) return false
  return profile.visitCount >= TRUST_THRESHOLD
}

// Human-readable trust level
function getTrustLabel(confidence) {
  if (confidence >= 0.9) return "Highly Trusted"
  if (confidence >= 0.7) return "Trusted"
  if (confidence >= 0.4) return "Familiar"
  if (confidence >= 0.1) return "New"
  return "Unknown"
}

module.exports = { calculateConfidence, isTrusted, getTrustLabel, TRUST_THRESHOLD }
```

---

### Step 4 — deviationDetector.js

The core logic — compares a new visit against the stored profile and flags differences.

```javascript
// src/trust-profile/deviationDetector.js

const { isTrusted } = require("./confidenceScorer")

function detectDeviation(currentFingerprint, storedProfile) {

  // If we've never seen this domain, no deviation to detect
  if (!storedProfile) {
    return {
      detected: false,
      knownDomain: false,
      visitCount: 0,
      sslMismatch: false,
      formActionMismatch: false,
      details: "Domain not in trust profile — first visit"
    }
  }

  // If domain is known but not yet trusted (< 5 visits)
  // we record but don't flag as deviation
  if (!isTrusted(storedProfile)) {
    return {
      detected: false,
      knownDomain: true,
      visitCount: storedProfile.visitCount,
      sslMismatch: false,
      formActionMismatch: false,
      details: `Domain seen ${storedProfile.visitCount} time(s) — not yet enough visits to establish trust baseline`
    }
  }

  // Domain IS trusted — now check for deviations
  const deviations = []

  // Check 1: HTTPS usage changed
  if (storedProfile.fingerprint.protocol !== currentFingerprint.protocol) {
    deviations.push("Protocol changed (was HTTPS, now HTTP or vice versa)")
  }

  // Check 2: Login form action changed
  if (
    storedProfile.fingerprint.loginFormAction &&
    currentFingerprint.loginFormAction &&
    storedProfile.fingerprint.loginFormAction !== currentFingerprint.loginFormAction
  ) {
    deviations.push(
      `Login form now submits to "${currentFingerprint.loginFormAction}" instead of the usual "${storedProfile.fingerprint.loginFormAction}"`
    )
  }

  // Check 3: Page title changed drastically
  // (Real bank pages have consistent titles)
  if (
    storedProfile.fingerprint.pageTitle &&
    currentFingerprint.pageTitle &&
    !titlesAreSimilar(storedProfile.fingerprint.pageTitle, currentFingerprint.pageTitle)
  ) {
    deviations.push(`Page title changed significantly`)
  }

  const detected = deviations.length > 0

  return {
    detected,
    knownDomain: true,
    visitCount: storedProfile.visitCount,
    sslMismatch: deviations.some(d => d.includes("Protocol")),
    formActionMismatch: deviations.some(d => d.includes("form")),
    details: detected
      ? deviations.join("; ")
      : `Matches trusted profile (${storedProfile.visitCount} previous visits)`
  }
}

// Check if two page titles are roughly similar
function titlesAreSimilar(title1, title2) {
  const clean1 = title1.toLowerCase().replace(/[^a-z0-9]/g, "")
  const clean2 = title2.toLowerCase().replace(/[^a-z0-9]/g, "")

  // Allow for minor differences (page-specific titles)
  // Just check if the bank name is still in the title
  const words1 = clean1.split("").slice(0, 10).join("")
  const words2 = clean2.split("").slice(0, 10).join("")

  return words1 === words2
}

module.exports = { detectDeviation }
```

---

### Step 5 — feedbackHandler.js

Updates trust profiles based on what the user tells us through the UI.

```javascript
// src/trust-profile/feedbackHandler.js

const { dbGet, dbSet } = require("./dbSetup")

// Called when user clicks "Mark as safe" in Person 4's UI
async function markAsSafe(domain, fingerprint) {
  const existing = await dbGet(domain)

  if (existing) {
    // Update existing profile
    existing.visitCount += 1
    existing.lastVisited = new Date().toISOString()
    existing.fingerprint = fingerprint  // Update to latest fingerprint
    existing.userConfirmedSafe = true
    existing.isConsistent = true
    await dbSet(existing)
  } else {
    // Create new profile
    await dbSet({
      domain,
      visitCount: 1,
      firstVisited: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      fingerprint,
      userConfirmedSafe: true,
      isConsistent: true,
      flaggedAsThreat: false
    })
  }

  console.log(`Sentrio: Marked ${domain} as safe`)
}

// Called when user clicks "Confirm threat" in Person 4's UI
async function confirmThreat(domain) {
  const existing = await dbGet(domain)

  if (existing) {
    existing.flaggedAsThreat = true
    existing.lastFlagged = new Date().toISOString()
    await dbSet(existing)
  } else {
    await dbSet({
      domain,
      visitCount: 0,
      firstVisited: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      fingerprint: null,
      userConfirmedSafe: false,
      isConsistent: false,
      flaggedAsThreat: true,
      lastFlagged: new Date().toISOString()
    })
  }

  console.log(`Sentrio: Confirmed ${domain} as threat`)
}

module.exports = { markAsSafe, confirmThreat }
```

---

### Step 6 — profileManager.js

The main entry point. This is what Person 1 calls.

```javascript
// src/trust-profile/profileManager.js

const { dbGet, dbSet } = require("./dbSetup")
const { extractFingerprint } = require("./fingerprinter")
const { detectDeviation } = require("./deviationDetector")
const { calculateConfidence, isTrusted } = require("./confidenceScorer")
const { markAsSafe, confirmThreat } = require("./feedbackHandler")

// Main function — called by Person 1's content script
// Returns profileDeviation object
async function getProfileDeviation(domain) {
  try {
    const storedProfile = await dbGet(domain)
    const currentFingerprint = extractFingerprint()
    const deviation = detectDeviation(currentFingerprint, storedProfile)

    // Silently update the profile in the background
    // (only if the page seems legitimate — no suspicious signals yet)
    updateProfileSilently(domain, currentFingerprint, storedProfile)

    return deviation

  } catch (error) {
    console.warn("Sentrio: Trust profile error:", error)
    // Fail safe — return no deviation rather than crashing
    return { detected: false, details: "Trust profile unavailable" }
  }
}

// Update profile silently on every visit (even before AI verdict)
async function updateProfileSilently(domain, fingerprint, existingProfile) {
  try {
    if (existingProfile) {
      existingProfile.visitCount += 1
      existingProfile.lastVisited = new Date().toISOString()
      // Only update fingerprint if consistent
      if (!existingProfile.flaggedAsThreat) {
        existingProfile.fingerprint = fingerprint
      }
      await dbSet(existingProfile)
    } else {
      await dbSet({
        domain,
        visitCount: 1,
        firstVisited: new Date().toISOString(),
        lastVisited: new Date().toISOString(),
        fingerprint,
        userConfirmedSafe: false,
        isConsistent: true,
        flaggedAsThreat: false
      })
    }
  } catch (error) {
    console.warn("Sentrio: Could not update trust profile:", error)
  }
}

// Get a profile's trust status for the UI popup
async function getProfileSummary(domain) {
  const profile = await dbGet(domain)
  if (!profile) return null

  return {
    domain,
    visitCount: profile.visitCount,
    firstVisited: profile.firstVisited,
    lastVisited: profile.lastVisited,
    isTrusted: isTrusted(profile),
    confidence: calculateConfidence(profile),
    flaggedAsThreat: profile.flaggedAsThreat
  }
}

module.exports = { getProfileDeviation, getProfileSummary, markAsSafe, confirmThreat }
```

---

## The Interface Contract

### What you OUTPUT (goes to Person 1)

```javascript
const profileDeviation = {
  detected: true,             // boolean — was a deviation found?
  knownDomain: true,          // boolean — have we seen this domain before?
  visitCount: 12,             // number — how many times user visited this domain
  sslMismatch: true,          // boolean — did SSL change?
  formActionMismatch: false,  // boolean — did form submission URL change?
  details: "Login form now submits to evil.ru instead of the usual hnb.lk"
}
```

### What you RECEIVE (from Person 4 — user feedback)

```javascript
// When user clicks "Mark as safe"
markAsSafe(domain, fingerprint)

// When user clicks "Confirm threat"
confirmThreat(domain)
```

---

## How to Test Your Work Alone

You do not need anyone else's code. Everything runs as a standalone JS module.

**Test 1 — Basic profile creation:**
```javascript
const { getProfileDeviation, markAsSafe } = require("./profileManager")

// First visit — should return no deviation, unknown domain
getProfileDeviation("hnb.lk").then(console.log)

// Mark as safe 5 times to build trust
for (let i = 0; i < 5; i++) {
  markAsSafe("hnb.lk", {
    protocol: "https:",
    loginFormAction: "hnb.lk",
    pageTitle: "HNB Internet Banking"
  })
}

// Should now show as trusted
getProfileDeviation("hnb.lk").then(console.log)
```

**Test 2 — Deviation detection:**
```javascript
// After establishing trust, simulate a changed form action
// Manually set a profile, then call with different fingerprint
```

**Test 3 — Test in browser:**
Since IndexedDB is a browser API, open `chrome://extensions`, load the extension, visit a site 5+ times, then check:
```javascript
// In browser console on any page:
indexedDB.open("sentrio_trust_profiles").onsuccess = (e) => {
  const db = e.target.result
  const tx = db.transaction("profiles", "readonly")
  tx.objectStore("profiles").getAll().onsuccess = (e) => console.log(e.target.result)
}
```

---

## Before You Merge to Dev — Checklist

- [ ] `getProfileDeviation()` returns correct object for unknown domain
- [ ] `getProfileDeviation()` returns correct object for known but not-yet-trusted domain
- [ ] `getProfileDeviation()` detects form action mismatch on trusted domain
- [ ] `markAsSafe()` increments visit count correctly
- [ ] `confirmThreat()` sets flaggedAsThreat correctly
- [ ] After 5 visits, `isTrusted()` returns true
- [ ] No crash when IndexedDB is unavailable (fail safe)
- [ ] `profileDeviation` object matches the interface contract exactly
- [ ] Tested in actual Chrome extension context (not just Node.js)

---

## Important Notes

- **Do not touch** `src/core/`, `src/ai-agent/`, or `src/ui/`
- **IndexedDB only works in browser context** — you cannot test with plain `node` for the browser parts. Test by loading the extension in Chrome
- **All data stays on device** — never add any code that sends profile data externally
- The `getProfileDeviation()` function must never crash — always wrap in try/catch and return a safe default
