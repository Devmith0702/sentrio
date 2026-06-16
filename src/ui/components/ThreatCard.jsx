// src/ui/components/ThreatCard.jsx
// Main alert card — fixed bottom-right, always on top, slides in with animation

import React, { useState, useEffect } from "react"
import { RiskBadge } from "./RiskBadge"
import { ActionButtons } from "./ActionButtons"

// Header gradient colours keyed by risk level
const HEADER_GRADIENT = {
  safe:     "linear-gradient(135deg, #15803d, #16a34a)",
  low:      "linear-gradient(135deg, #a16207, #ca8a04)",
  medium:   "linear-gradient(135deg, #c2410c, #ea580c)",
  high:     "linear-gradient(135deg, #b91c1c, #dc2626)",
  critical: "linear-gradient(135deg, #7f1d1d, #991b1b)"
}

// Left border accent colour
const ACCENT_COLOR = {
  safe:     "#16a34a",
  low:      "#ca8a04",
  medium:   "#ea580c",
  high:     "#dc2626",
  critical: "#7f1d1d"
}

// Confidence badge
function ConfidencePill({ confidence }) {
  if (!confidence) return null
  const colors = {
    high:   { color: "#15803d", bg: "#dcfce7" },
    medium: { color: "#a16207", bg: "#fef9c3" },
    low:    { color: "#6b7280", bg: "#f3f4f6" }
  }
  const c = colors[confidence] || colors.low
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: "600",
        padding: "2px 8px",
        borderRadius: "999px",
        backgroundColor: c.bg,
        color: c.color,
        letterSpacing: "0.04em",
        textTransform: "uppercase"
      }}
    >
      {confidence} confidence
    </span>
  )
}

export function ThreatCard({
  verdict,
  currentURL,
  onClose,
  onMarkSafe,
  onConfirmThreat
}) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Trigger entrance animation after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const dismiss = (callback) => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      if (callback) callback()
      if (onClose) onClose()
    }, 280)
  }

  const handleLeave = () => {
    dismiss(() => window.history.back())
  }

  const handleProceed = () => {
    dismiss()
  }

  const headerGradient = HEADER_GRADIENT[verdict.riskLevel] || HEADER_GRADIENT.medium
  const accentColor    = ACCENT_COLOR[verdict.riskLevel]    || ACCENT_COLOR.medium

  // Compute domain safely
  let domainDisplay = currentURL
  try {
    domainDisplay = new URL(currentURL).hostname
  } catch (_) {}

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        width: "370px",
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        boxShadow:
          "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)",
        zIndex: 2147483647,
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        borderLeft: `4px solid ${accentColor}`,
        // Slide-in / slide-out animation via inline transform
        opacity:    exiting ? 0 : visible ? 1 : 0,
        transform:  exiting
          ? "translateY(16px) scale(0.97)"
          : visible
          ? "translateY(0) scale(1)"
          : "translateY(20px) scale(0.97)",
        transition: exiting
          ? "opacity 0.28s ease-in, transform 0.28s ease-in"
          : "opacity 0.32s cubic-bezier(0.22,1,0.36,1), transform 0.32s cubic-bezier(0.22,1,0.36,1)"
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          background: headerGradient,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "20px", lineHeight: 1 }}>🛡️</span>
          <div>
            <div
              style={{
                color: "white",
                fontWeight: "700",
                fontSize: "14px",
                letterSpacing: "0.02em"
              }}
            >
              Sentrio Alert
            </div>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "11px" }}>
              Threat detected on this page
            </div>
          </div>
        </div>

        {/* Close / dismiss button */}
        <button
          onClick={handleProceed}
          title="Dismiss"
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "white",
            cursor: "pointer",
            fontSize: "18px",
            lineHeight: 1,
            borderRadius: "6px",
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s"
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.28)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          ×
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "16px" }}>

        {/* Risk badge + confidence row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "14px",
            flexWrap: "wrap"
          }}
        >
          <RiskBadge riskLevel={verdict.riskLevel} />
          <ConfidencePill confidence={verdict.confidence} />
          {verdict.isFallback && (
            <span
              style={{
                fontSize: "10px",
                color: "#9ca3af",
                fontStyle: "italic"
              }}
            >
              (offline analysis)
            </span>
          )}
        </div>

        {/* Tactic */}
        <div
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#111827",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span style={{ color: accentColor }}>⚑</span>
          <span>Detected: {verdict.tactic}</span>
        </div>

        {/* Explanation box */}
        <div
          style={{
            fontSize: "13px",
            color: "#4b5563",
            lineHeight: "1.6",
            padding: "10px 12px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            marginBottom: "10px"
          }}
        >
          {verdict.explanation}
        </div>

        {/* URL chip */}
        <div
          style={{
            fontSize: "11px",
            color: "#9ca3af",
            wordBreak: "break-all",
            display: "flex",
            alignItems: "flex-start",
            gap: "4px"
          }}
        >
          <span style={{ flexShrink: 0, marginTop: "1px" }}>🔗</span>
          <span>{domainDisplay}</span>
        </div>

        {/* Action buttons */}
        <ActionButtons
          recommendation={verdict.recommendation}
          onProceed={handleProceed}
          onLeave={handleLeave}
          onMarkSafe={() => dismiss(onMarkSafe)}
          onConfirmThreat={() => dismiss(onConfirmThreat)}
        />
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #f3f4f6",
          fontSize: "10px",
          color: "#d1d5db",
          textAlign: "right",
          letterSpacing: "0.03em"
        }}
      >
        Sentrio · Mora Vortex · Aurora 2026
      </div>
    </div>
  )
}
