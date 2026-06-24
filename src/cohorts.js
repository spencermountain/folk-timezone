// Group IANA time zones into cohorts that share identical DST change dates
// over the last N years. Only the start/end days matter — offset is ignored.
//
//   node src/cohorts.js          # use every year in the dataset
//   node src/cohorts.js 10       # cohort by the most recent 10 years
//   node src/cohorts.js 10 -o    # ...and write data/cohorts.json too
//
// Output (stdout): JSON array, largest cohort first:
//   [
//     { changes: [ { year: 2006, start: "04-28", end: "09-21" }, ... ],
//       timezones: ["Africa/Cairo", ...] },
//     ...
//   ]

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "data", "dst-changes.json"), "utf8"),
)

const args = process.argv.slice(2)
const write = args.includes("-o") || args.includes("--out")
const nArg = args.find((a) => /^\d+$/.test(a))
const n = nArg ? Number(nArg) : Infinity

// Reduce each zone to the start/end dates of its most recent N years.
function changesOf(zone) {
  const years = data[zone].years
  const window = Number.isFinite(n) ? years.slice(-n) : years
  return window.map((r) => ({ year: r.year, start: r.start, end: r.end }))
}

// Bucket zones by the exact sequence of (year, start, end) — that string is
// the cohort's identity.
const buckets = new Map()
for (const zone of Object.keys(data)) {
  const changes = changesOf(zone)
  const key = JSON.stringify(changes)
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { changes, timezones: [] }
    buckets.set(key, bucket)
  }
  bucket.timezones.push(zone)
}

const cohorts = [...buckets.values()]
  .map((c) => ({ changes: c.changes, timezones: c.timezones.sort() }))
  .sort((a, b) => b.timezones.length - a.timezones.length || a.timezones[0].localeCompare(b.timezones[0]))

const json = JSON.stringify(cohorts, null, 2)
console.log(json)

const span = Number.isFinite(n) ? `last ${n} year(s)` : "all years"
console.error(
  `${cohorts.length} cohorts across ${Object.keys(data).length} zones (${span}).`,
)

if (write) {
  const out = path.join(__dirname, "..", "data", "cohorts.json")
  fs.writeFileSync(out, json)
  console.error(`Wrote ${out}`)
}
