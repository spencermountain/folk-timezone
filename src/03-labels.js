// Label each DST change in every cohort by *when in the month* it falls:
// the month, the weekday, and which occurrence of that weekday it is
// (1st..5th), plus whether it's the last such weekday of the month.
//
// This makes patterns inspectable, e.g. "is every change the last Sunday of
// March?" Uses the spacetime library for the calendar math.
//
// Each change gains `startLabel` / `endLabel`, e.g.:
//   { month: "March", day: "Sunday", nth: 5, last: true }
// (null when that transition doesn't exist for the year.)

import spacetime from "spacetime"

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th"]

// Label a single "MM-DD" date in a given year.
//
// `nth` is computed by walking the calendar rather than dividing: find the
// first occurrence of this weekday in the month, then step forward 7 days at a
// time, counting, until we land on the target date. This is unambiguous about
// what "3rd Sunday" means and doesn't rely on day-number arithmetic.
function labelDate(year, monthDay) {
  if (!monthDay) return null
  const target = spacetime(`${year}-${monthDay}`)
  const weekday = target.format("day") // e.g. "Sunday"

  // Find the first <weekday> of the month.
  let cursor = target.startOf("month")
  while (cursor.format("day") !== weekday) cursor = cursor.add(1, "day")

  // Step a week at a time until we reach the target date.
  let nth = 1
  while (cursor.isBefore(target)) {
    cursor = cursor.add(7, "day")
    nth++
  }

  return {
    month: target.format("month"), // "March"
    day: weekday, // "Sunday"
    nth, // 1..5
    last: cursor.add(7, "day").month() !== target.month(), // last weekday-of-its-kind?
  }
}

// Return a copy of the cohorts with every change's start/end labeled.
const labelCohorts = (cohorts) =>
  cohorts.map((cohort) => ({
    ...cohort,
    changes: cohort.changes.map((c) => ({
      ...c,
      startLabel: labelDate(c.year, c.start),
      endLabel: labelDate(c.year, c.end),
    })),
  }))

// Collapse a column of labels (one per year) into a human description, so we
// can see at a glance whether a cohort follows a single consistent rule.
function describe(labels) {
  const real = labels.filter(Boolean)
  if (real.length === 0) return "—"
  const [first] = real
  const sameWeekdayMonth = real.every((l) => l.month === first.month && l.day === first.day)
  if (!sameWeekdayMonth) return "varies"
  if (real.every((l) => l.last)) return `last ${first.day} of ${first.month}`
  if (real.every((l) => l.nth === first.nth))
    return `${ORDINALS[first.nth]} ${first.day} of ${first.month}`
  return `${first.day} of ${first.month} (week varies)`
}

// Pretty-print the labeled cohorts: the start/end rule and the member zones.
function printLabels(cohorts) {
  cohorts.forEach((cohort, i) => {
    console.log("─".repeat(60))
    console.log(`Cohort ${i + 1}  ·  ${cohort.timezones.length} zone(s)`)
    console.log(`  start: ${describe(cohort.changes.map((c) => c.startLabel))}`)
    console.log(`  end:   ${describe(cohort.changes.map((c) => c.endLabel))}`)
    for (const z of cohort.timezones) console.log(`    ${z}`)
    console.log()
  })
}

export default labelCohorts
export { labelDate, describe, printLabels }
