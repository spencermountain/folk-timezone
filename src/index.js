// Pretty-print the DST dataset: each time zone, with each year indented
// below showing its offset, start and end.
//
//   node src/index.js                 # print every zone
//   node src/index.js America Europe  # only zones matching any argument

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataFile = path.join(__dirname, "..", "data", "dst-changes.json")
const data = JSON.parse(fs.readFileSync(dataFile, "utf8"))

const filters = process.argv.slice(2)
const matches = (zone) =>
  filters.length === 0 || filters.some((f) => zone.toLowerCase().includes(f.toLowerCase()))

// Format a UTC offset in hours as "UTC-5", "UTC+9:30", etc.
function fmtOffset(hours) {
  const sign = hours < 0 ? "-" : "+"
  const abs = Math.abs(hours)
  const h = Math.trunc(abs)
  const m = Math.round((abs - h) * 60)
  return `UTC${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`
}

const zones = Object.keys(data).filter(matches).sort()

for (const zone of zones) {
  const { active, years } = data[zone]
  console.log(`${zone}  [${active ? "active" : "inactive"}]`)
  for (const row of years) {
    const offset = fmtOffset(row.offset).padEnd(9)
    if (row.start === null && row.end === null) {
      console.log(`  ${row.year}  ${offset}  (no DST)`)
    } else {
      const delta = `+${row.delta}h`
      console.log(
        `  ${row.year}  ${offset}  ${delta}  start ${row.start ?? "—"}  end ${row.end ?? "—"}`,
      )
    }
  }
  console.log()
}

console.error(`Printed ${zones.length} zone(s).`)
