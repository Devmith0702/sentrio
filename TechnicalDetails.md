 Build the complete Chrome extension based on this specification. Start with the manifest, content scripts, background service worker, React UI components, IndexedDB storage layer, and Claude API integration. Ensure all privacy constraints and ethical safeguards are implemented.

SENTRIO — TECHNICAL BUILD SPECIFICATION
Extracted from Aurora 2026 Proposal | Mora Vortex
1. PROJECT DEFINITION
Product Name: Sentrio
Type: Chrome Browser Extension (Manifest V3)
Core Function: Agentic AI-powered real-time protection against social engineering attacks targeting Sri Lankan banking users, with secondary detection of prompt injection threats targeting AI agents.
Autonomy Level: Fully autonomous — perceives web environment, reasons across threat signals, makes independent risk decisions, and responds with explainable warnings without requiring user action.

2. TARGET THREAT LANDSCAPE
Primary Threats:
* Fake banking websites (phishing)
* Authority impersonation (BOC, HNB, Sampath, People's Bank, etc.)
* Typosquatting and homoglyph attacks (e.g., hnb-secure.net, sampth.lk with Cyrillic 'a')
* Subdomain abuse (e.g., boc.lk.login-verify.com where real domain is login-verify.com)
* Prompt injection hidden in web pages
User Context: Sri Lankan internet users (12.4M internet users, 88.9% adults with bank accounts). Vulnerable population: moderate digital literacy users who regularly use banking apps/websites but cannot identify URL manipulation or SSL anomalies.

3. SYSTEM ARCHITECTURE — THREE-LAYER PIPELINE
3.1 Layer 1: Local Fast Checks (Instant, No API)
Trigger: Executes immediately on every page load via content script.
Logic: If any check flags suspicious → escalate to Layer 2. If clean → show silent green checkmark and update Layer 3.
Checks Performed:
1. Sri Lankan Bank Domain Verification — Hardcoded registry of verified domains:
    * BOC: boc.lk
    * HNB: hnb.lk
    * Sampath: sampath.lk
    * People's Bank: peoplesbank.lk
    * Commercial Bank: combank.lk
    * NSB: nsb.lk
    * Seylan: seylan.lk
    * NDB: ndb.lk
    * DFCC: dfcc.lk
2. Homoglyph Detection — Unicode normalization (NFKD) + confusables map to detect visually identical characters from non-Latin scripts substituted into domain names (e.g., Cyrillic replacing Latin 'a').
3. Subdomain Abuse Detection — Parse whether a known bank name appears as a subdomain rather than the registered domain.
4. Hidden Content Scan — Scan for:
    * CSS-hidden elements
    * White-on-white text
    * HTML comment fields containing prompt injection payloads
5. Personal Trust Profile Comparison — Check if current domain visited before; compare SSL issuer and login form action against stored values. Flag deviations.
3.2 Layer 2: Agentic AI Reasoning (Claude API)
Trigger: Only when Layer 1 raises a flag.
Input: Structured evidence package containing:
* Current URL and full domain structure
* Page DOM (visible text, hidden elements, HTML comments, metadata)
* SSL certificate issuer and fingerprint
* Login form action URLs
* User's personal trust profile (stored locally)
AI Model: claude-sonnet-4-20250514 (Claude API)
Agent Instructions:
1. Evaluate all signals holistically
2. Identify specific social engineering tactic in use
3. Assess whether combination indicates genuine threat or false positive
4. Produce plain-language explanation suitable for non-technical user
5. Assign risk level: Low / Medium / High / Critical
Output:
* Risk verdict: Safe / Suspicious / Threat
* Plain-language explanation of triggered signals
* Named social engineering tactic (e.g., "Typosquatting", "Authority Impersonation")
* Recommended action: proceed / proceed with caution / block
* Updated personal trust profile entry
3.3 Layer 3: Prompt Injection Detection
Execution: Runs in parallel with bank site analysis on every page.
Scans for:
* Instruction-format text in hidden DOM elements ("Ignore previous instructions...")
* System-prompt override attempts in HTML comments or metadata
* Authority impersonation phrases targeting AI systems
Significance: Addresses compounded threat where fake bank site also hosts prompt injection targeting AI browser agents.

4. DECISION-MAKING — MULTI-SIGNAL CONFIDENCE MODEL
Table



Signal	Weight	Example
Domain not in verified bank registry	High	hnb-login.com
Homoglyph character detected	Critical	Cyrillic 'a' in domain
Subdomain abuse	High	boc.lk.verify.net
Domain age < 30 days	Medium	New registration
SSL issuer mismatch	High	Unknown CA on bank page
Login form posts to external URL	Critical	Data sent off-site
Hidden text with injection payload	High	White text on white bg
Deviates from personal trust profile	Medium	New SSL fingerprint
5. RESPONSE GENERATION (UI OVERLAY)
When Threat Confirmed: Display overlay panel showing:
* Risk level with color coding (green / amber / red)
* What was detected (e.g., "This page claims to be HNB Bank but the domain hnb-secure.net was registered 3 days ago and your login credentials would be sent to an external server.")
* Named tactic (e.g., "Tactic: Typosquatting + Authority Impersonation")
* Recommended action: Proceed / Proceed with Caution / Leave Page
* User feedback buttons: Confirm threat / Mark as safe (feeds learning layer)
When Safe: Silent green checkmark. No interruption.

6. LEARNING AND FEEDBACK MECHANISM
Storage: Personal Trust Profile stored locally in browser's IndexedDB (never transmitted).
Data Recorded on Every Legitimate Site Visit (confirmed safe by agent + not overridden by user):
* Canonical domain and SSL certificate fingerprint
* Login form destination URL
* Visit count and confidence score
* Typical session duration
Trust Profile Logic:
* After 5 confirmed visits to a domain → becomes a Trusted Profile Entry
* Subsequent visits deviating from fingerprint → flagged with personalized message: "This does not match the HNB Bank you have visited 23 times."
* User feedback buttons (Confirm threat / Mark as safe) incorporated into profile learning
* User overrides always respected

7. TECHNOLOGY STACK
Table



Component	Technology
Browser Extension	Chrome Manifest V3, JavaScript
AI Reasoning Engine	Claude API (claude-sonnet-4-20250514)
Local Storage	IndexedDB (on-device, never transmitted)
Homoglyph Detection	Unicode normalization (NFKD) + confusables map
DOM Analysis	Content Scripts, MutationObserver
UI Framework	React (extension popup + overlay)
Domain Age Check	WHOIS API (free tier)
Extension Permissions Required: activeTab, storage, minimum necessary only.

8. DATA FLOW & WORKFLOW
plain


User navigates to website
    ↓
Chrome Extension Content Script
    ↓
Layer 1: Local Fast Checks
    ↓
Suspicious? ──No──→ Safe (Silent green checkmark) ──→ Layer 3: Update Personal Trust Profile
    ↓ Yes
Layer 2: AI Agent Analysis (Claude API)
    ↓
Threat confirmed? ──No──→ Safe (Silent green checkmark) ──→ Layer 3
    ↓ Yes
Alert (Explain threat, warn user) ──→ Layer 3: Update Personal Trust Profile

External API Call Rule: Claude API called ONLY when Layer 1 flags suspicious. Normal browsing generates zero external calls. API communication over HTTPS.

9. ETHICAL & PRIVACY CONSTRAINTS (Must Implement)
1. Privacy Protection: All personal trust profile data exclusively on-device via IndexedDB. No browsing history, URLs, or behavior transmitted externally. Evidence package sent to Claude API contains zero personally identifiable information.
2. Data Handling: API call triggered only on Layer 1 flag. Minimum permissions only.
3. Harmful Output Prevention: System prompt restricts AI output to security analysis only. AI cannot autonomously submit forms, redirect, or access data beyond reading current page DOM. All actions require passive display or explicit user consent.
4. Human Supervision: Every alert includes Confirm threat / Mark as safe buttons. User overrides respected. System never blocks page without giving user option to proceed.
5. Transparency: Never show generic warnings. Every alert must name specific signal, social engineering tactic, and reasoning behind risk score.
6. Safe Testing: All development/testing using intentionally constructed demo pages simulating attacks. No real banking infrastructure or live user data.
7. Ethical Limitations: System must acknowledge uncertainty. False positives possible for newly registered legitimate domains. Always present evidence, never binary "safe/unsafe" without explanation.

10. KEY DIFFERENTIATORS FROM EXISTING TOOLS
Table



Capability	Existing Tools (Blacklist-based)	Sentrio
Detection approach	Blacklist / reputation database	Live multi-signal AI reasoning
Detects zero-day fake sites	❌ (requires prior report)	✅ (no report needed)
Sri Lankan bank domain registry	❌ (generic databases)	✅ (local banks pre-loaded)
Explains reasoning to user	❌ (silent block/flag)	✅ (named tactic + detail)
Prompt injection detection	❌	✅ (DOM scan)
Subdomain abuse detection	❌	✅
11. EXPECTED OUTPUTS FOR BUILD
The AI coding assistant should generate:
1. Chrome Extension Manifest V3 structure with activeTab and storage permissions
2. Content Script for Layer 1 (domain checks, homoglyph detection, hidden content scan, DOM parsing)
3. Background/Service Worker for API calls to Claude and WHOIS
4. React-based UI Overlay for alerts (risk levels, explanations, feedback buttons)
5. IndexedDB Schema for Personal Trust Profile (domain, SSL fingerprint, form URL, visit count, confidence, session duration)
6. Claude API Integration with structured evidence package prompt engineering
7. Prompt Injection Scanner (parallel DOM scanner)
8. Signal Weighting Engine implementing the confidence model
9. Demo/Test Pages for safe testing environment
10. Privacy-compliant data flow ensuring no PII leaves the device
