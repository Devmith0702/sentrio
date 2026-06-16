// src/ai-agent/apiClient.js
// Handles all AI API communication for Sentrio.
// Provider is controlled by CONFIG.PROVIDER: "groq" | "gemini" | "claude"

const { CONFIG } = require("./config")

// ── Fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
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

// ── Groq API (OpenAI-compatible — default free provider) ─────────────────────
async function callGroq(systemPrompt, userPrompt) {
  const body = {
    model: CONFIG.GROQ_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt }
    ]
  }

  const response = await fetchWithTimeout(
    CONFIG.GROQ_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${CONFIG.GROQ_API_KEY}`
      },
      body: JSON.stringify(body)
    },
    CONFIG.TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Groq API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// ── Gemini API (backup free option) ──────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  const url = `${CONFIG.GEMINI_ENDPOINT}?key=${CONFIG.GEMINI_API_KEY}`

  const body = {
    contents: [
      {
        parts: [{ text: systemPrompt + "\n\n" + userPrompt }]
      }
    ],
    generationConfig: {
      maxOutputTokens: CONFIG.MAX_TOKENS,
      temperature: 0.1
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

// ── Claude API (Aurora demo only) ────────────────────────────────────────────
async function callClaude(systemPrompt, userPrompt) {
  const body = {
    model: CONFIG.CLAUDE_MODEL,
    max_tokens: CONFIG.MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
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

// ── Main entry point ──────────────────────────────────────────────────────────
async function callAI(systemPrompt, userPrompt) {
  switch (CONFIG.PROVIDER) {
    case "groq":   return await callGroq(systemPrompt, userPrompt)
    case "gemini": return await callGemini(systemPrompt, userPrompt)
    case "claude": return await callClaude(systemPrompt, userPrompt)
    default:       throw new Error(`Unknown AI provider: "${CONFIG.PROVIDER}"`)
  }
}

module.exports = { callAI }
