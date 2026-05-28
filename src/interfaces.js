/**
 * SENTRIO — SHARED INTERFACES
 * All team members must follow these contracts exactly.
 * Do not change without discussing with the team first.
 */

// Person 1  → Person 2 
const threatSignals = {
  url: "",
  registeredDomain: "",
  isBankImpersonation: false,
  bankClaimed: "",
  homoglyphDetected: false,
  subdomainAbuse: false,
  hiddenTextFound: false,
  hiddenTextContent: "",
  profileDeviation: { detected: false, details: "" }
}

// Person 2  → Person 4 
const verdict = {
  riskLevel: "",        // "safe" | "low" | "medium" | "high" | "critical"
  tactic: "",
  explanation: "",
  recommendation: ""    // "proceed" | "caution" | "leave"
}

// Person 3  → Person 1
const profileDeviation = {
  detected: false,
  knownDomain: false,
  visitCount: 0,
  sslMismatch: false,
  formActionMismatch: false,
  details: ""
}

module.exports = { threatSignals, verdict, profileDeviation }
