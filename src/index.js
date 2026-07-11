import fs from "fs"
import getTimezones from "./01-build-dst.js"
import getCohorts from "./02-cohorts.js"
import labelCohorts, { printLabels } from "./03-labels.js"
import deriveRules from "./04-rules.js"

// How many recent years to cohort by (optional CLI arg; default = all).
const nArg = process.argv.slice(2).find((a) => /^\d+$/.test(a))
const n = nArg ? Number(nArg) : Infinity

const data = getTimezones() // build in memory (last 20 years)
const cohorts = getCohorts(data, n) // group by identical DST change dates
const labeled = labelCohorts(cohorts) // tag each change with {month, day, nth, last}
const rules = deriveRules(labeled) // fit a weekly rule to each cohort + score it

// pretty-print the cohorts with their start/end rule
printLabels(labeled)

fs.writeFileSync("data/cohorts.json", JSON.stringify(labeled, null, 2))
fs.writeFileSync("data/rules.json", JSON.stringify(rules, null, 2))
