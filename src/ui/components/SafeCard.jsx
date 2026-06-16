// src/ui/components/SafeCard.jsx
// Minimal green toast — shows "✅ Safe — {domain}" and auto-dismisses after 3s

import React, { useState, useEffect } from "react"

export function SafeCard({ domain }) {
  const [phase, setPhase] = useState("entering") // "entering" | "visible" | "exiting"

  useEffect(() => {
    // Entrance: mount → entering → visible
    const enterTimer = setTimeout(() => setPhase("visible"), 30)

    // After 3s, start exit animation
    const exitStart = setTimeout(() => setPhase("exiting"), 3000)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(exitStart)
    }
  }, [])

  // Derive transform/opacity from phase
  const opacity   = phase === "entering" ? 0 : phase === "exiting" ? 0 : 1
  const transform =
    phase === "entering"
      ? "translateY(16px) scale(0.97)"
      : phase === "exiting"
      ? "translateY(16px) scale(0.97)"
      : "translateY(0) scale(1)"
  const transition =
    phase === "exiting"
      ? "opacity 0.4s ease-in, transform 0.4s ease-in"
      : "opacity 0.3s cubic-bezier(0.22,1,0.36,1), transform 0.3s cubic-bezier(0.22,1,0.36,1)"

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        backgroundColor: "#f0fdf4",
        border: "1.5px solid #86efac",
        borderLeft: "4px solid #16a34a",
        borderRadius: "10px",
        padding: "12px 18px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        zIndex: 2147483647,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        boxShadow: "0 8px 24px rgba(22,163,74,0.15), 0 2px 8px rgba(0,0,0,0.06)",
        minWidth: "220px",
        opacity,
        transform,
        transition,
        pointerEvents: phase === "exiting" ? "none" : "auto"
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          backgroundColor: "#dcfce7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: "18px"
        }}
      >
        ✅
      </div>

      {/* Text */}
      <div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#15803d",
            letterSpacing: "0.01em"
          }}
        >
          Sentrio: Safe
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "1px" }}>
          {domain || "This page"}
        </div>
      </div>

      {/* Shield icon on the right */}
      <div
        style={{
          marginLeft: "auto",
          fontSize: "20px",
          opacity: 0.3
        }}
      >
        🛡️
      </div>
    </div>
  )
}
