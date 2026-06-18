// src/core/bankRegistry.js

const BANK_REGISTRY = {
  "boc.lk":           "Bank of Ceylon",
  "peoplesbank.lk":   "People's Bank",
  "hnb.lk":           "Hatton National Bank",
  "sampath.lk":       "Sampath Bank",
  "combank.lk":       "Commercial Bank",
  "nsb.lk":           "National Savings Bank",
  "seylan.lk":        "Seylan Bank",
  "ndb.lk":           "National Development Bank",
  "dfcc.lk":          "DFCC Bank",
  "panasiabank.lk":   "Pan Asia Bank",
  "unionb.lk":        "Union Bank",
  "amanabank.lk":     "Amana Bank",
  "mcb.lk":           "MCB Bank",
  "hsbc.lk":          "HSBC Sri Lanka",
  "sc.lk":            "Standard Chartered Sri Lanka",

  // Official online-banking portals on a SEPARATE registered domain from the
  // bank's main .lk site. These must be listed explicitly — banks that serve
  // online banking from a subdomain (e.g. online.boc.lk) are already covered
  // because the registered domain resolves to the main entry above.
  "sampathvishwa.com": "Sampath Bank (Sampath Vishwa online banking)"
}

function getVerifiedBank(domain) {
  return BANK_REGISTRY[domain] || null
}

function containsBankName(str) {
  const lower = str.toLowerCase()
  const bankNames = [
    "boc", "peoples", "hnb", "sampath", "combank", "commercial",
    "nsb", "seylan", "ndb", "dfcc", "panasia", "hatton", "national"
  ]
  return bankNames.some(name => lower.includes(name))
}
