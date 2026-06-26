// src/ai-agent/config.example.js
// Template for src/ai-agent/config.js (which is git-ignored — it holds real keys).
//
//   cp src/ai-agent/config.example.js src/ai-agent/config.js
//
// then set the API key for whichever PROVIDER you use. Leaving the keys blank is
// fine for the build and the offline test suites — only the optional "Live API"
// tests need a real key (they auto-skip when none is set).

const CONFIG = {
  // "groq" = default (fast + free), "gemini" = fallback, "claude" = Aurora demo only
  PROVIDER: "groq",

  // Groq — FREE, fast, recommended for development
  GROQ_API_KEY: "",
  GROQ_MODEL: "llama-3.3-70b-versatile",
  GROQ_ENDPOINT: "https://api.groq.com/openai/v1/chat/completions",

  // Gemini — backup free option
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "gemini-2.0-flash",
  GEMINI_ENDPOINT: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",

  // Claude — use for final Aurora demo only
  CLAUDE_API_KEY: "",
  CLAUDE_MODEL: "claude-sonnet-4-20250514",
  CLAUDE_ENDPOINT: "https://api.anthropic.com/v1/messages",

  TIMEOUT_MS: 10000,
  MAX_TOKENS: 500,
}

// Node / bundler (CommonJS) consumers — used by the test suites and ai-agent modules.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONFIG }
}

// Service-worker consumer — background.js loads this via importScripts() and reads
// self.SENTRIO_CONFIG.
if (typeof self !== "undefined") {
  self.SENTRIO_CONFIG = CONFIG
}
