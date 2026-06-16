// src/ai-agent/responseParser.js
// Parses and validates the raw text returned by the AI into a clean verdict object.
// This acts as a safety net — if the AI returns anything unexpected, we catch it here
// and return a safe fallback rather than crashing the extension.

const VALID_RISK_LEVELS    = ["safe", "low", "medium", "high", "critical"]
const VALID_RECOMMENDATIONS = ["proceed", "caution", "leave"]

// ── parseResponse ─────────────────────────────────────────────────────────────
// Takes raw AI output text and returns a validated verdict object.
// Throws a descriptive error if the response is malformed or missing required fields.
function parseResponse(rawText) {

  // Step 1: Strip markdown code fences that some models add despite instructions
  // e.g. ```json { ... } ``` → { ... }
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim()

  // Step 2: Parse as JSON
  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch (e) {
    throw new Error("AI response is not valid JSON: " + e.message)
  }

  // Step 3: Check all required fields are present and non-empty
  const requiredFields = ["riskLevel", "tactic", "explanation", "recommendation"]
  for (const field of requiredFields) {
    if (!parsed[field] || typeof parsed[field] !== "string" || parsed[field].trim() === "") {
      throw new Error(`Missing or empty required field: "${field}"`)
    }
  }

  // Step 4: Validate riskLevel is a recognised value
  if (!VALID_RISK_LEVELS.includes(parsed.riskLevel)) {
    throw new Error(
      `Invalid riskLevel "${parsed.riskLevel}". Must be one of: ${VALID_RISK_LEVELS.join(", ")}`
    )
  }

  // Step 5: Validate recommendation is a recognised value
  if (!VALID_RECOMMENDATIONS.includes(parsed.recommendation)) {
    throw new Error(
      `Invalid recommendation "${parsed.recommendation}". Must be one of: ${VALID_RECOMMENDATIONS.join(", ")}`
    )
  }

  // Step 6: Return a clean object with only the fields the interface contract expects
  return {
    riskLevel:      parsed.riskLevel,
    tactic:         parsed.tactic.trim(),
    explanation:    parsed.explanation.trim(),
    recommendation: parsed.recommendation
  }
}

// ── getFallbackVerdict ────────────────────────────────────────────────────────
// Returns a safe default verdict when parsing fails or the AI is unavailable.
// Always uses "caution" so the user is never silently left unprotected.
function getFallbackVerdict() {
  return {
    riskLevel:      "medium",
    tactic:         "Unknown",
    explanation:    "Sentrio could not analyse this page. Proceed with caution.",
    recommendation: "caution"
  }
}

module.exports = { parseResponse, getFallbackVerdict }
