// src/ui/components/ActionButtons.jsx
// Primary action button (matches recommendation) + feedback buttons

import React, { useState } from "react"

const BUTTON_STYLES = {
  proceed: {
    label: "Proceed Anyway",
    color: "#374151",
    bg: "#f3f4f6",
    border: "#d1d5db",
    hoverBg: "#e5e7eb",
    icon: "→"
  },
  caution: {
    label: "Proceed with Caution",
    color: "#92400e",
    bg: "#fffbeb",
    border: "#fcd34d",
    hoverBg: "#fef3c7",
    icon: "⚡"
  },
  leave: {
    label: "Leave This Page",
    color: "#ffffff",
    bg: "#dc2626",
    border: "#dc2626",
    hoverBg: "#b91c1c",
    icon: "← Exit"
  }
}

function PrimaryButton({ config, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "11px 16px",
        borderRadius: "8px",
        border: `1.5px solid ${config.border}`,
        backgroundColor: hovered ? config.hoverBg : config.bg,
        color: config.color,
        fontWeight: "700",
        fontSize: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        transition: "all 0.15s ease",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        letterSpacing: "0.01em",
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.12)" : "none"
      }}
    >
      <span style={{ fontSize: "13px" }}>{config.icon}</span>
      <span>{config.label}</span>
    </button>
  )
}

function FeedbackButton({ label, color, bg, border, hoverBg, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        padding: "8px 10px",
        borderRadius: "7px",
        border: `1px solid ${border}`,
        backgroundColor: hovered ? hoverBg : bg,
        color: color,
        fontSize: "12px",
        cursor: "pointer",
        fontWeight: "600",
        transition: "all 0.15s ease",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
      }}
    >
      {label}
    </button>
  )
}

export function ActionButtons({
  recommendation,
  onProceed,
  onLeave,
  onMarkSafe,
  onConfirmThreat
}) {
  const recKey = ["proceed", "caution", "leave"].includes(recommendation)
    ? recommendation
    : "caution"

  const primaryConfig = BUTTON_STYLES[recKey]
  const primaryAction = recKey === "leave" ? onLeave : onProceed

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        marginTop: "16px"
      }}
    >
      {/* Primary action button */}
      <PrimaryButton config={primaryConfig} onClick={primaryAction} />

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
      >
        <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
        <span style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap" }}>
          Was this helpful?
        </span>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#e5e7eb" }} />
      </div>

      {/* Feedback buttons row */}
      <div style={{ display: "flex", gap: "8px" }}>
        <FeedbackButton
          label="✓ Mark as Safe"
          color="#15803d"
          bg="#f0fdf4"
          border="#86efac"
          hoverBg="#dcfce7"
          onClick={onMarkSafe}
        />
        <FeedbackButton
          label="✗ Confirm Threat"
          color="#b91c1c"
          bg="#fef2f2"
          border="#fca5a5"
          hoverBg="#fee2e2"
          onClick={onConfirmThreat}
        />
      </div>
    </div>
  )
}
