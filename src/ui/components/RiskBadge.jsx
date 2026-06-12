// src/ui/components/RiskBadge.jsx
// Coloured pill badge showing risk level with emoji + label

import React from "react"

const RISK_CONFIG = {
  safe: {
    color: "#15803d",
    bg: "#dcfce7",
    border: "#86efac",
    label: "SAFE",
    emoji: "✅",
    glow: "rgba(22,163,74,0.15)"
  },
  low: {
    color: "#a16207",
    bg: "#fef9c3",
    border: "#fde047",
    label: "LOW RISK",
    emoji: "⚠️",
    glow: "rgba(202,138,4,0.15)"
  },
  medium: {
    color: "#c2410c",
    bg: "#ffedd5",
    border: "#fdba74",
    label: "MEDIUM RISK",
    emoji: "⚠️",
    glow: "rgba(234,88,12,0.15)"
  },
  high: {
    color: "#b91c1c",
    bg: "#fee2e2",
    border: "#fca5a5",
    label: "HIGH RISK",
    emoji: "🚨",
    glow: "rgba(220,38,38,0.15)"
  },
  critical: {
    color: "#7f1d1d",
    bg: "#fecaca",
    border: "#f87171",
    label: "CRITICAL",
    emoji: "🔴",
    glow: "rgba(127,29,29,0.2)"
  }
}

export function RiskBadge({ riskLevel, large = false }) {
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.low

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: large ? "8px" : "6px",
        padding: large ? "8px 18px" : "5px 12px",
        borderRadius: "999px",
        backgroundColor: config.bg,
        color: config.color,
        fontWeight: "700",
        fontSize: large ? "15px" : "12px",
        letterSpacing: "0.06em",
        border: `1.5px solid ${config.border}`,
        boxShadow: `0 0 0 4px ${config.glow}`,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        userSelect: "none"
      }}
    >
      <span style={{ fontSize: large ? "16px" : "13px", lineHeight: 1 }}>
        {config.emoji}
      </span>
      <span>{config.label}</span>
    </div>
  )
}
