// src/ai-agent/apiClient.js
// Handles all AI API communication for Sentrio (Gemini during dev, Claude for Aurora demo)

const { CONFIG } = require("./config")

// ── Fetch with timeout ────────────────────────────────────────────────────────
// Wraps the native fetch with an AbortController so requests don't hang forever.
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timer)
    return response
  } catch (error) {
    clearTimeout(timer)
    if (error.name === "AbortError") {
      throw new Error("API request timed out after " + timeoutMs + "ms")
    }
    throw error
  }
}

// ── Gemini API (free tier — use during development) ───────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  const url = `${CONFIG.GEMINI_ENDPOINT}?key=${CONFIG.GEMINI_API_KEY}`

  const body = {
    contents: [
      {
        parts: [
          // Gemini doesn't have a separate system role, so we prefix it to the user turn
          { text: systemPrompt + "\n\n" + userPrompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: CONFIG.MAX_TOKENS,
      temperature: 0.1  // Low temperature = consistent, structured JSON output
    }
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    },
    CONFIG.TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

// ── Claude API (paid — use for final Aurora demo only) ────────────────────────
async function callClaude(systemPrompt, userPrompt) {
  const body = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    system: systemPrompt,
    messages: [
      { role: "user", content: userPrompt }
    ]
  }

  const response = await fetchWithTimeout(
    CONFIG.CLAUDE_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CONFIG.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    },
    CONFIG.TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  return data.content[0].text
}

// ── Main entry point — routes to whichever AI is configured ───────────────────
async function callAI(systemPrompt, userPrompt) {
  if (CONFIG.USE_CLAUDE) {
    return await callClaude(systemPrompt, userPrompt)
  } else {
    return await callGemini(systemPrompt, userPrompt)
  }
}

module.exports = { callAI }
