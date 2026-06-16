const { dbGet, dbSet } = require("./dbSetup")

async function markAsSafe(domain, fingerprint) {
  const existing = await dbGet(domain)

  if (existing) {
    existing.visitCount += 1
    existing.lastVisited = new Date().toISOString()
    existing.fingerprint = fingerprint
    existing.userConfirmedSafe = true
    existing.isConsistent = true
    await dbSet(existing)
  } else {
    await dbSet({
      domain,
      visitCount: 1,
      firstVisited: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      fingerprint,
      userConfirmedSafe: true,
      isConsistent: true,
      flaggedAsThreat: false
    })
  }

  console.log(`Sentrio: Marked ${domain} as safe`)
}

async function confirmThreat(domain) {
  const existing = await dbGet(domain)

  if (existing) {
    existing.flaggedAsThreat = true
    existing.lastFlagged = new Date().toISOString()
    await dbSet(existing)
  } else {
    await dbSet({
      domain,
      visitCount: 0,
      firstVisited: new Date().toISOString(),
      lastVisited: new Date().toISOString(),
      fingerprint: null,
      userConfirmedSafe: false,
      isConsistent: false,
      flaggedAsThreat: true,
      lastFlagged: new Date().toISOString()
    })
  }

  console.log(`Sentrio: Confirmed ${domain} as threat`)
}

module.exports = { markAsSafe, confirmThreat }
