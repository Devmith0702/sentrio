// src/core/domScanner.js

const INJECTION_KEYWORDS = [
  "ignore previous instructions",
  "ignore all previous",
  "you are now",
  "new instructions",
  "system prompt",
  "disregard",
  "forget everything",
  "act as",
  "you must now",
  "override"
]

// Subtrees that never hold rendered injection text — skipping them (and their
// children) keeps the walk small on heavy pages.
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE"])

function scanDOM() {
  const findings = []

  // Hidden-text scan. Same predicate as before — hidden AND >10 chars AND an
  // injection keyword — but evaluated cheap-checks-first so the costly
  // getComputedStyle() only runs for the handful of elements that actually
  // contain an injection phrase, instead of for every element on the page.
  const root = document.body || document.documentElement
  if (root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode: el =>
        SKIP_TAGS.has(el.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    })
    let el
    while ((el = walker.nextNode())) {
      const text = el.innerText
      if (!text) continue
      const trimmed = text.trim()
      if (trimmed.length <= 10) continue
      const lower = trimmed.toLowerCase()
      if (!INJECTION_KEYWORDS.some(kw => lower.includes(kw))) continue

      const style = window.getComputedStyle(el)
      const isHidden =
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        style.fontSize === "0px" ||
        (style.color === style.backgroundColor && trimmed.length > 0)

      if (isHidden) {
        findings.push({ type: "hidden_element", content: trimmed.substring(0, 200) })
      }
    }
  }

  const iterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_COMMENT
  )
  let comment
  while ((comment = iterator.nextNode())) {
    const text = comment.nodeValue.toLowerCase()
    if (INJECTION_KEYWORDS.some(kw => text.includes(kw))) {
      findings.push({
        type: "html_comment",
        content: comment.nodeValue.trim().substring(0, 200)
      })
    }
  }

  const metaTags = document.querySelectorAll("meta")
  metaTags.forEach(meta => {
    const content = (meta.getAttribute("content") || "").toLowerCase()
    if (INJECTION_KEYWORDS.some(kw => content.includes(kw))) {
      findings.push({
        type: "meta_tag",
        content: meta.getAttribute("content").substring(0, 200)
      })
    }
  })

  const forms = document.querySelectorAll("form")
  const formFindings = []
  forms.forEach(form => {
    const action = form.getAttribute("action")
    if (!action) return

    // Resolve the action against the current page, then compare origins.
    // Only a form posting to a DIFFERENT origin is a real exfiltration signal.
    // Relative actions like "index", "search", "./login" resolve to the same
    // origin and are completely benign — the old check wrongly flagged those.
    try {
      const resolved = new URL(action, window.location.href)
      if (resolved.origin !== window.location.origin) {
        formFindings.push({
          type: "suspicious_form_action",
          action: action
        })
      }
    } catch {
      // Unparseable action — ignore rather than flag
    }
  })

  return {
    injectionFound: findings.length > 0,
    injectionDetails: findings,
    suspiciousFormActions: formFindings,
    loginFormPresent: document.querySelectorAll("input[type='password']").length > 0
  }
}
