// src/ai-agent/fallbackHandler.js
// Handles all failure scenarios so the extension never crashes or leaves
// the user unprotected when the AI API is unavailable or returns bad data.

const { getFallbackVerdict } = require("./responseParser")

// ── handleAPIError ────────────────────────────────────────────────────────────
// Receives any error thrown by apiClient.js or responseParser.js, logs a clear
// description of what went wrong, and always returns a safe fallback verdict.
function handleAPIError(error) {
  const message = error.message || ""

  // Detect the failure type from the error message and log accordingly
  if (message.includes("timed out")) {
    console.warn("Sentrio: API request timed out — the AI took too long to respond.")

  } else if (message.includes("401")) {
    console.warn("Sentrio: Invalid API key — check CONFIG.GEMINI_API_KEY or CONFIG.CLAUDE_API_KEY.")

  } else if (message.includes("429")) {
    console.warn("Sentrio: API quota exceeded — too many requests. Try again shortly.")

  } else if (message.includes("not valid JSON")) {
    console.warn("Sentrio: AI returned a malformed response that could not be parsed.")

  } else {
    console.warn("Sentrio: Unexpected error —", message)
  }

  // Always return a safe verdict so the user receives feedback regardless of the failure
  return getFallbackVerdict()
}

// ── isNetworkAvailable ────────────────────────────────────────────────────────
// Quick check using the browser's built-in online status before attempting an
// API call. Avoids unnecessary fetch attempts when the user is offline.
function isNetworkAvailable() {
  // navigator.onLine is a browser-only API
  // In Node.js testing environment, navigator is undefined — default to true
  if (typeof navigator === "undefined") return true
  if (typeof navigator.onLine === "undefined") return true
  return navigator.onLine
}

module.exports = { handleAPIError, isNetworkAvailable }
