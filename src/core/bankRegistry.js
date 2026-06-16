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
  "sc.lk":            "Standard Chartered Sri Lanka"
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
