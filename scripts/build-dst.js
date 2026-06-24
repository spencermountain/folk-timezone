// Build a dataset of IANA time zones and their DST transitions, year by year.
//
// Output shape (written to data/dst-changes.json):
//   {
//     "America/New_York": {
//       active: true,   // still observes DST as of the most recent year
//       years: [
//         { year: 2020, offset: -5, delta: 1, start: "03-08", end: "11-01" },
//         ...
//       ],
//     },
//     ...
//   }
//
// `active` = the zone still changed its clocks in the most recent year in range.
// `offset` = the standard-time (non-DST) UTC offset for that year, in hours.
// `delta`  = the DST shift, in hours (usually 1; e.g. 0.5 for Lord Howe).
// `start`  = the day the clocks jump forward (DST begins / "spring forward").
// `end`    = the day the clocks fall back (DST ends / "fall back").
// During [start, end] the effective offset is `offset + delta`.
// Years with no clock change are kept with `delta: 0` and null start/end.
// Hour-of-day is intentionally discarded — only the calendar day matters.
//
// No dependencies: transitions are read straight from the IANA tz database that
// ships with Node via the built-in `Intl` API, so the data tracks whatever tzdata
// version your Node install has. Re-run any time (or after a Node/tzdata update)
// to regenerate.
//
// Usage:
//   node build-dst.js                 # last 20 complete years
//   node build-dst.js 2010 2025       # explicit [startYear, endYear] inclusive
//   node build-dst.js --all-zones     # also emit zones that never observe DST

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

// ---- config -------------------------------------------------------------

const argv = process.argv.slice(2)
const includeNonDst = argv.includes("--all-zones")
const years = argv.filter((a) => /^\d{4}$/.test(a)).map(Number)

// Default: the 20 most recent *complete* years. Today is mid-year, so the
// current year is excluded (it has no full set of transitions yet).
const thisYear = new Date().getUTCFullYear()
const END_YEAR = years[1] ?? years[0] ?? thisYear - 1
const START_YEAR = years[0] && years[1] ? years[0] : END_YEAR - 19

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(__dirname, "..", "data", "dst-changes.json")

// ---- offset helpers -----------------------------------------------------

// One formatter per zone, reused across the ~millions of probes below.
const fmtCache = new Map()
function offsetFormatter(timeZone) {
  let f = fmtCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    fmtCache.set(timeZone, f)
  }
  return f
}

// Offset (minutes east of UTC) for `timeZone` at instant `date`.
// Works by reading the wall-clock time in the zone and diffing it from the
// real UTC instant.
function offsetMinutes(timeZone, date) {
  const p = {}
  for (const { type, value } of offsetFormatter(timeZone).formatToParts(date)) {
    p[type] = value
  }
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return Math.round((wall - date.getTime()) / 60000)
}

// "MM-DD" for the local calendar day of `date` in `timeZone`.
const dateCache = new Map()
function localMonthDay(timeZone, date) {
  let f = dateCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    dateCache.set(timeZone, f)
  }
  return f.format(date).slice(5) // "YYYY-MM-DD" -> "MM-DD"
}

const DAY = 86400000
const MINUTE = 60000

// Find every offset change in [yearStart, yearEnd) for one zone.
// Returns [{ at: Date (instant just after the change), before, after, delta } ]
// where before/after/delta are in minutes.
function transitionsInYear(timeZone, year) {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const out = []

  let prevTime = start
  let prevOff = offsetMinutes(timeZone, new Date(prevTime))

  for (let t = start + DAY; t <= end; t += DAY) {
    const off = offsetMinutes(timeZone, new Date(t))
    if (off !== prevOff) {
      // Change happened in (prevTime, t]; binary-search to the minute.
      let lo = prevTime
      let hi = t
      while (hi - lo > MINUTE) {
        const mid = lo + Math.floor((hi - lo) / 2)
        if (offsetMinutes(timeZone, new Date(mid)) === prevOff) lo = mid
        else hi = mid
      }
      out.push({ at: new Date(hi), before: prevOff, after: off, delta: off - prevOff })
      prevOff = off
    }
    prevTime = t
  }
  return out
}

// ---- build --------------------------------------------------------------

const zones = Intl.supportedValuesOf("timeZone")
console.error(
  `Computing DST transitions for ${zones.length} zones, ${START_YEAR}-${END_YEAR}...`,
)

const result = {}
let dstZoneCount = 0

for (const zone of zones) {
  const rows = []

  let hasDst = false

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const trans = transitionsInYear(zone, year)
    if (trans.length === 0) {
      // No clock change this year: fixed offset all year (zone hadn't adopted
      // DST yet, or had abolished it). Keep the year with null start/end.
      const fixedMin = offsetMinutes(zone, new Date(Date.UTC(year, 0, 1)))
      rows.push({ year, offset: fixedMin / 60, delta: 0, start: null, end: null })
      continue
    }
    hasDst = true

    // start = a forward jump (entering DST), end = a backward jump (leaving DST).
    const forward = trans.find((t) => t.delta > 0)
    const backward = trans.find((t) => t.delta < 0)

    // Standard offset = what's in effect outside DST: the offset before a
    // forward jump, or the offset after a backward jump. DST shift is the
    // size of the forward jump (or the undoing of the backward one).
    const stdMin = forward ? forward.before : backward.after
    const deltaMin = forward ? forward.delta : -backward.delta

    const row = {
      year,
      offset: stdMin / 60,
      delta: deltaMin / 60,
      start: forward ? localMonthDay(zone, forward.at) : null,
      end: backward ? localMonthDay(zone, backward.at) : null,
    }

    // Surface anything that doesn't fit the simple spring/fall model
    // (e.g. Africa/Casablanca toggles around Ramadan -> up to 4 changes/yr).
    if (trans.length > 2) {
      row.transitions = trans.map((t) => ({
        day: localMonthDay(zone, t.at),
        delta: t.delta / 60,
      }))
    }
    rows.push(row)
  }

  // `active` = the zone still observes DST as of the most recent year in range.
  const active = rows.length > 0 && rows[rows.length - 1].delta !== 0

  // A zone is included if it observes DST in at least one year in range; its
  // non-DST years are kept as null rows. `--all-zones` keeps every zone.
  if (hasDst) {
    result[zone] = { active, years: rows }
    dstZoneCount++
  } else if (includeNonDst) {
    result[zone] = { active, years: rows }
  }
}

fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2))
console.error(
  `Wrote ${OUT_FILE}: ${Object.keys(result).length} zones ` +
    `(${dstZoneCount} observe DST in range).`,
)
