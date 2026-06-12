// src/ui/overlay-inject.js
// Content script — injects the Sentrio React overlay into any host page.
// This file is the Parcel entry point for the overlay bundle.

import React from "react"
import { createRoot } from "react-dom/client"
import { Overlay } from "./overlay"

// ── Guard: only inject once ──────────────────────────────────────────────────
if (!document.getElementById("sentrio-overlay-root")) {

  // 1. Inject the slide-in / slide-out keyframe animation into the host page
  //    (The ThreatCard and SafeCard use inline transition instead, but we keep
  //     this stylesheet for any future CSS class usage and for the reset.)
  const styleEl = document.createElement("style")
  styleEl.id = "sentrio-overlay-styles"
  styleEl.textContent = `
    #sentrio-overlay-root {
      /* Isolation: prevent host page styles from leaking in */
      all: initial;
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      /* Pointer events pass through the invisible wrapper */
      pointer-events: none;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* Let cards themselves receive pointer events */
    #sentrio-overlay-root > * {
      pointer-events: auto;
    }

    @keyframes sentrio-slide-in {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.97);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes sentrio-slide-out {
      from {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateY(16px) scale(0.97);
      }
    }
  `

  // Prefer appending to <head>; fall back to <html> if head isn't ready yet
  ;(document.head || document.documentElement).appendChild(styleEl)

  // 2. Create the container div and attach to <body>
  const container = document.createElement("div")
  container.id = "sentrio-overlay-root"

  // Wait for body to be available (handles very early injection)
  const attach = () => {
    ;(document.body || document.documentElement).appendChild(container)

    // 3. Mount the React overlay
    const root = createRoot(container)
    root.render(<Overlay />)
  }

  if (document.body) {
    attach()
  } else {
    // Body not ready yet — wait for DOMContentLoaded
    document.addEventListener("DOMContentLoaded", attach, { once: true })
  }
}
