// src/ui/overlay.jsx
// Root overlay component — listens for chrome.runtime messages
// and renders ThreatCard or SafeCard accordingly

import React, { useState, useEffect, useCallback } from "react"
import { ThreatCard } from "./components/ThreatCard"
import { SafeCard } from "./components/SafeCard"

export function Overlay() {
  const [state, setState] = useState({
    type: null,    // "threat" | "safe" | null
    verdict: null,
    url: null
  })

  // Message handler — registered once
  useEffect(() => {
    const handleMessage = (message) => {
      if (message.type === "SHOW_VERDICT" && message.payload) {
        setState({
          type: "threat",
          verdict: message.payload,
          url: window.location.href
        })
      }

      if (message.type === "SHOW_SAFE") {
        setState({
          type: "safe",
          verdict: null,
          url: message.payload?.url || window.location.href
        })
      }
    }

    // Only attach if chrome runtime is available (extension context)
    if (
      typeof chrome !== "undefined" &&
      chrome.runtime &&
      chrome.runtime.onMessage
    ) {
      chrome.runtime.onMessage.addListener(handleMessage)
      return () => {
        // Chrome may already have removed the context; guard the removal
        try {
          chrome.runtime.onMessage.removeListener(handleMessage)
        } catch (_) {}
      }
    }
  }, [])

  const handleClose = useCallback(() => {
    setState({ type: null, verdict: null, url: null })
  }, [])

  const handleMarkSafe = useCallback(() => {
    if (!state.url) return
    let domain = state.url
    try { domain = new URL(state.url).hostname } catch (_) {}
    try {
      chrome.runtime.sendMessage({
        type: "MARK_SAFE",
        payload: { domain }
      })
    } catch (_) {}
    handleClose()
  }, [state.url, handleClose])

  const handleConfirmThreat = useCallback(() => {
    if (!state.url) return
    let domain = state.url
    try { domain = new URL(state.url).hostname } catch (_) {}
    try {
      chrome.runtime.sendMessage({
        type: "CONFIRM_THREAT",
        payload: { domain }
      })
    } catch (_) {}
    handleClose()
  }, [state.url, handleClose])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (state.type === "threat" && state.verdict) {
    return (
      <ThreatCard
        verdict={state.verdict}
        currentURL={state.url || window.location.href}
        onClose={handleClose}
        onMarkSafe={handleMarkSafe}
        onConfirmThreat={handleConfirmThreat}
      />
    )
  }

  if (state.type === "safe") {
    let domain = state.url || window.location.href
    try { domain = new URL(domain).hostname } catch (_) {}
    return <SafeCard domain={domain} />
  }

  return null
}
