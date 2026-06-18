/**
 * Sentrio — Full End-to-End Working Demo
 *
 * For each real scenario this runs the COMPLETE product:
 *   Layer 1 (real core modules) → threat signals
 *   Layer 2 (real Groq AI)      → verdict        (only when escalated)
 *   UI       (real .jsx cards)  → rendered in Chrome and screenshotted
 *
 * Proves the whole pipeline works together with live AI and the real UI.
 * Run with: node demo.js   →   screenshots land in test-results/demo-*.png
 */

const puppeteer = require("puppeteer-core")
const fs   = require("fs")
const path = require("path")

const CHROME  = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const OUT     = path.join(".", "test-results")
fs.mkdirSync(OUT, { recursive: true })

const G = s => `\x1b[32m${s}\x1b[0m`, C = s => `\x1b[36m${s}\x1b[0m`,
      Y = s => `\x1b[33m${s}\x1b[0m`, W = s => `\x1b[1m${s}\x1b[0m`, R = s => `\x1b[31m${s}\x1b[0m`

// ── Load real Layer 1 modules into this scope ───────────────────────────────
const ctx = {}
;["bankRegistry","urlAnalyser","homoglyphDetector","subdomainChecker","signalBuilder"]
  .forEach(m => { (0, eval)(fs.readFileSync(`src/core/${m}.js`, "utf8")) })

// ── Real Layer 2 (Groq) ─────────────────────────────────────────────────────
Object.keys(require.cache).filter(k => k.includes("ai-agent")).forEach(k => delete require.cache[k])
const { analyseThreats } = require("./src/ai-agent/agentCore")

// ── Build threat signals the same way content.js does ───────────────────────
function buildSignals(url, dom) {
  const urlData = analyseURL(url)
  const verified = getVerifiedBank(urlData.registeredDomain)
  const bankCheck = {
    isVerifiedBank: !!verified,
    bankClaimed: verified || (containsBankName(urlData.hostname) ? urlData.hostname : null),
    claimingToBeBank: containsBankName(urlData.hostname)
  }
  const hom = detectHomoglyphs(urlData.hostname)
  const sub = checkSubdomainAbuse(urlData)
  const domResult = Object.assign(
    { injectionFound:false, injectionDetails:[], suspiciousFormActions:[], loginFormPresent:false },
    dom || {}
  )
  return buildThreatSignals(urlData, bankCheck, hom, sub, domResult, { detected:false, details:"" })
}

// ── Scenarios (real URLs) ───────────────────────────────────────────────────
const SCENARIOS = [
  { id:1, title:"Verified bank — real HNB",       url:"https://www.hnb.lk/login",
    dom:{ loginFormPresent:true } },
  { id:2, title:"Fake bank — impersonation + .xyz", url:"https://hnb-secure.xyz/login",
    dom:{ loginFormPresent:true } },
  { id:3, title:"Subdomain abuse — boc.lk.*",      url:"https://boc.lk.verify-me.com/login",
    dom:{ loginFormPresent:true } },
  { id:4, title:"Homoglyph — c0mbank.lk",          url:"https://c0mbank.lk/login",
    dom:{ loginFormPresent:true } },
  { id:5, title:"Normal site — ChatGPT (no FP)",   url:"https://chatgpt.com/",
    dom:{ injectionFound:true, injectionDetails:[{content:"system prompt act as"}], loginFormPresent:false } },
]

// ── Bundle the REAL UI components for in-browser rendering ───────────────────
function bundleComponents() {
  const files = [
    "src/ui/components/RiskBadge.jsx",
    "src/ui/components/ActionButtons.jsx",
    "src/ui/components/SafeCard.jsx",
    "src/ui/components/ThreatCard.jsx",
  ]
  let out = "const { useState, useEffect, useRef } = React;\n"
  for (const f of files) {
    let src = fs.readFileSync(f, "utf8")
    src = src
      .split("\n")
      .filter(l => !/^\s*import\s/.test(l))           // drop import lines
      .join("\n")
      .replace(/export\s+function/g, "function")        // export function → function
      .replace(/export\s+const/g, "const")
    out += "\n// ===== " + path.basename(f) + " =====\n" + src + "\n"
  }
  return out
}

// ── Generate the demo page (mock site + real card overlay) ──────────────────
function buildHtml(componentBundle, scenarioData) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Sentrio Demo</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  /* Fake browser chrome */
  .chrome{height:44px;background:#e8eaed;display:flex;align-items:center;padding:0 12px;gap:10px;border-bottom:1px solid #d0d3d8}
  .dots{display:flex;gap:6px}.dot{width:12px;height:12px;border-radius:50%}
  .r{background:#ff5f57}.y{background:#febc2e}.g{background:#28c840}
  .bar{flex:1;background:#fff;border-radius:8px;padding:7px 14px;font-size:13px;color:#333;border:1px solid #d0d3d8;display:flex;align-items:center;gap:8px}
  /* Mock page body — looks like a bank login */
  .page{height:calc(100vh - 44px);background:linear-gradient(160deg,#0a2540,#123a63);position:relative;overflow:hidden}
  .mock{max-width:380px;margin:60px auto 0;background:#fff;border-radius:12px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
  .mock h2{font-size:20px;color:#0a2540;margin-bottom:4px}
  .mock p{font-size:12px;color:#888;margin-bottom:18px}
  .mock input{width:100%;padding:11px;border:1px solid #ddd;border-radius:7px;margin-bottom:12px;font-size:14px}
  .mock button{width:100%;padding:11px;background:#0a2540;color:#fff;border:none;border-radius:7px;font-size:14px;font-weight:600;cursor:pointer}
  #root{position:absolute;inset:0;pointer-events:none}
</style></head>
<body>
  <div class="chrome">
    <div class="dots"><div class="dot r"></div><div class="dot y"></div><div class="dot g"></div></div>
    <div class="bar"><span id="lock">🔒</span><span id="addr"></span></div>
  </div>
  <div class="page">
    <div class="mock">
      <h2 id="bankName">Internet Banking</h2>
      <p>Sign in to your account</p>
      <input placeholder="Username"/>
      <input type="password" placeholder="Password"/>
      <button>Login</button>
    </div>
    <div id="root"></div>
  </div>

  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>window.__S__ = ${JSON.stringify(scenarioData)};</script>
  <script type="text/babel">
    ${componentBundle}

    const S = window.__S__;
    document.getElementById("addr").textContent = S.url;
    document.getElementById("lock").textContent = S.url.startsWith("https") ? "🔒" : "⚠️";
    document.getElementById("bankName").textContent = S.bankName || "Internet Banking";

    const root = ReactDOM.createRoot(document.getElementById("root"));
    if (S.kind === "threat") {
      root.render(<ThreatCard verdict={S.verdict} currentURL={S.url}
        onClose={()=>{}} onMarkSafe={()=>{}} onConfirmThreat={()=>{}} />);
    } else {
      root.render(<SafeCard domain={S.domain} />);
    }
    window.__ready = true;
  </script>
</body></html>`
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(W("\n╔══════════════════════════════════════════════╗"))
  console.log(W("║   Sentrio — Full Working Product Demo        ║"))
  console.log(W("╚══════════════════════════════════════════════╝\n"))

  // Step 1: run the real pipeline for each scenario
  const results = []
  for (const s of SCENARIOS) {
    const signals = buildSignals(s.url, s.dom)
    const hostname = new URL(s.url).hostname
    let data

    if (signals.shouldEscalateToAI) {
      process.stdout.write(C(`  [${s.id}] ${s.title} → escalating to Groq... `))
      const verdict = await analyseThreats(signals)
      console.log(G(`${verdict.riskLevel}/${verdict.recommendation}`))
      data = { kind:"threat", url:s.url, domain:hostname, verdict, bankName: signals.bankClaimed || "Internet Banking" }
    } else {
      console.log(C(`  [${s.id}] ${s.title} → `) + G("SAFE (no AI call)"))
      data = { kind:"safe", url:s.url, domain:hostname, bankName: signals.bankClaimed || "Internet Banking" }
    }
    results.push({ scenario:s, data })
  }

  // Step 2: render each in real Chrome and screenshot
  console.log(C("\n  Rendering real UI components in Chrome...\n"))
  const bundle = bundleComponents()
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, defaultViewport: { width: 900, height: 680 },
    args: ["--no-first-run","--no-default-browser-check","--force-device-scale-factor=2"]
  })

  const shots = []
  for (const { scenario, data } of results) {
    const html = buildHtml(bundle, data)
    const file = path.join(OUT, `_demo_s${scenario.id}.html`)
    fs.writeFileSync(file, html)
    const page = await browser.newPage()
    const errs = []
    page.on("pageerror", e => errs.push(e.message))
    await page.goto("file://" + path.resolve(file), { waitUntil: "networkidle2", timeout: 30000 })
    await page.waitForFunction("window.__ready === true", { timeout: 10000 }).catch(()=>{})
    await new Promise(r => setTimeout(r, 900))  // let entrance animation settle
    const out = path.join(OUT, `demo-${scenario.id}-${data.kind}.png`)
    await page.screenshot({ path: out })
    shots.push(out)
    console.log("  " + (errs.length ? R("✗ "+errs[0].slice(0,60)) : G("✓ ")) + scenario.title + "  → " + out)
    fs.rmSync(file, { force: true })
    await page.close()
  }

  await browser.close()

  console.log(W("\n  Demo complete. Screenshots:"))
  shots.forEach(s => console.log("    " + s))
  console.log()
}

main().catch(e => { console.error(R("Demo crashed: " + e.message)); console.error(e.stack); process.exit(1) })
