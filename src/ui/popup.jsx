// src/ui/popup.jsx
// Extension toolbar popup — shows current domain and Sentrio branding

import React, { useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { RiskBadge } from "./components/RiskBadge"

// ── Small spinner for loading state ─────────────────────────────────────────
function Spinner() {
  return (
    <div
      style={{
        width: "20px",
        height: "20px",
        border: "2px solid rgba(255,255,255,0.25)",
        borderTopColor: "white",
        borderRadius: "50%",
        animation: "sentrio-spin 0.7s linear infinite",
        display: "inline-block"
      }}
    />
  )
}

// ── Domain chip ──────────────────────────────────────────────────────────────
function DomainChip({ domain, url }) {
  const isHttps = url?.startsWith("https://")

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}
    >
      {/* Protocol lock icon */}
      <span
        style={{
          fontSize: "14px",
          flexShrink: 0,
          color: isHttps ? "#16a34a" : "#9ca3af"
        }}
      >
        {isHttps ? "🔒" : "⚠️"}
      </span>

      <div style={{ overflow: "hidden" }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "#111827",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {domain || "Unknown domain"}
        </div>
        {url && (
          <div
            style={{
              fontSize: "10px",
              color: "#9ca3af",
              marginTop: "1px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {url}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Info row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, valueColor }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 0",
        borderBottom: "1px solid #f3f4f6"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
          color: "#6b7280"
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: valueColor || "#374151"
        }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Main popup component ─────────────────────────────────────────────────────
function Popup() {
  const [tab, setTab] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Inject popup spinner animation
    const style = document.createElement("style")
    style.textContent = `
      @keyframes sentrio-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes sentrio-fade-in {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      body { animation: sentrio-fade-in 0.2s ease-out; }
    `
    document.head.appendChild(style)

    // Query the active tab via chrome.tabs API
    if (
      typeof chrome !== "undefined" &&
      chrome.tabs &&
      chrome.tabs.query
    ) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const t = tabs?.[0]
        if (t) {
          let domain = t.url || ""
          try { domain = new URL(t.url).hostname } catch (_) {}
          setTab({ url: t.url, title: t.title, domain })
        }
        setLoading(false)
      })
    } else {
      // Fallback for testing outside extension context
      setTab({
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname
      })
      setLoading(false)
    }
  }, [])

  // ── Loading state ──
  if (loading) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #0f3460, #0b4d8c)",
          height: "200px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <Spinner />
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>
          Analysing page…
        </div>
      </div>
    )
  }

  // Determine if current tab is a supported URL
  const isSupported =
    tab?.url?.startsWith("http://") || tab?.url?.startsWith("https://")
  const isExtensionPage = tab?.url?.startsWith("chrome://") || tab?.url?.startsWith("chrome-extension://")

  return (
    <div
      style={{
        width: "340px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden"
      }}
    >

      {/* ── Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0f3460 0%, #0b4d8c 60%, #00b4d8 140%)",
          padding: "18px 16px 16px",
          color: "white",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Decorative blobs */}
        <div
          style={{
            position: "absolute",
            top: "-20px",
            right: "-20px",
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(0,180,216,0.18)",
            pointerEvents: "none"
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-30px",
            left: "60px",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            pointerEvents: "none"
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            position: "relative"
          }}
        >
          {/* Shield icon */}
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              backdropFilter: "blur(4px)",
              flexShrink: 0
            }}
          >
            🛡️
          </div>

          <div>
            <div
              style={{
                fontWeight: "800",
                fontSize: "18px",
                letterSpacing: "-0.01em",
                lineHeight: 1.1
              }}
            >
              Sentrio
            </div>
            <div
              style={{
                fontSize: "11px",
                opacity: 0.75,
                marginTop: "2px",
                fontWeight: "400"
              }}
            >
              Protecting Sri Lankan banking users
            </div>
          </div>
        </div>

        {/* Status pill */}
        <div
          style={{
            marginTop: "14px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: "999px",
            padding: "4px 12px 4px 8px",
            fontSize: "11px",
            color: "rgba(255,255,255,0.9)"
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: "#4ade80",
              display: "inline-block",
              boxShadow: "0 0 0 3px rgba(74,222,128,0.3)"
            }}
          />
          Protection Active
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "14px 16px" }}>

        {/* Current page section */}
        <div
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: "8px"
          }}
        >
          Currently Viewing
        </div>

        {isExtensionPage ? (
          <div
            style={{
              fontSize: "13px",
              color: "#9ca3af",
              fontStyle: "italic",
              padding: "10px",
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              border: "1px solid #e5e7eb"
            }}
          >
            Chrome system page — not analysed
          </div>
        ) : (
          <DomainChip domain={tab?.domain} url={tab?.url} />
        )}

        {/* Stats grid */}
        {isSupported && (
          <div style={{ marginTop: "14px" }}>
            <InfoRow icon="🔍" label="Analysis Mode"  value="AI Agent"      />
            <InfoRow icon="🌐" label="Region Filter"  value="Sri Lanka · LK" />
            <InfoRow
              icon="🟢"
              label="Engine Status"
              value="Online"
              valueColor="#16a34a"
            />
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid #f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div style={{ fontSize: "10px", color: "#d1d5db" }}>
          Mora Vortex · Aurora 2026
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "#00b4d8",
            fontWeight: "600",
            letterSpacing: "0.03em"
          }}
        >
          v1.0.0
        </div>
      </div>

    </div>
  )
}

// ── Mount ────────────────────────────────────────────────────────────────────
const rootEl = document.getElementById("root")
if (rootEl) {
  const root = createRoot(rootEl)
  root.render(<Popup />)
}
