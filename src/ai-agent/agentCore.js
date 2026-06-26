// src/ai-agent/agentCore.js
// Main orchestrator for Layer 2 — the only file Layer 1 needs to import.
// Receives threatSignals from Layer 1, runs AI analysis, returns a verdict to Layer 4.
//
// Flow: network check → build prompt → call AI → parse response → return verdict
//       any failure at any step → handleAPIError() → return fallback verdict

const { buildPrompt }                      = require("./promptBuilder")
const { callAI }                           = require("./apiClient")
const { parseResponse, getFallbackVerdict } = require("./responseParser")
const { handleAPIError, isNetworkAvailable } = require("./fallbackHandler")

// ── analyseThreats ────────────────────────────────────────────────────────────
// Entry point for Layer 1. Orchestrates all Layer 2 modules in sequence.
// Always returns a valid verdict object — never throws.
async function analyseThreats(threatSignals) {

  // Step 1: Check network before attempting any API call
  if (!isNetworkAvailable()) {
    console.warn("Sentrio: No network connection — returning fallback verdict.")
    return getFallbackVerdict()
  }

  try {
    // Step 2: Build the reasoning prompt from the threat signals
    const { systemPrompt, userPrompt } = buildPrompt(threatSignals)

    // Step 3: Call the AI (Groq by default; Gemini/Claude selectable via CONFIG.PROVIDER)
    const rawResponse = await callAI(systemPrompt, userPrompt)

    // Step 4: Parse and validate the AI's response into a clean verdict object
    const verdict = parseResponse(rawResponse)

    // Step 5: Return the verdict to Layer 1 → Layer 4
    return verdict

  } catch (error) {
    // Any failure in steps 2–4 is caught here and handled gracefully
    return handleAPIError(error)
  }
}

module.exports = { analyseThreats }
