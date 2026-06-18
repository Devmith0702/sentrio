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

function scanDOM() {
  const findings = []

  const allElements = document.querySelectorAll("*")
  allElements.forEach(el => {
    const style = window.getComputedStyle(el)
    const isHidden =
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0" ||
      style.fontSize === "0px" ||
      (style.color === style.backgroundColor && el.innerText?.trim().length > 0)

    if (isHidden && el.innerText?.trim().length > 10) {
      const text = el.innerText.trim().toLowerCase()
      if (INJECTION_KEYWORDS.some(kw => text.includes(kw))) {
        findings.push({
          type: "hidden_element",
          content: el.innerText.trim().substring(0, 200)
        })
      }
    }
  })

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
