// Derive a single DST rule for each cohort — e.g. "2nd Sunday of March" for the
// start, "1st Sunday of November" for the end — and score it by how many of the
// most recent *consecutive* years it holds.
//
// The rule is taken from the latest year and extended backwards: we count how
// many years in a row (working back from the most recent) still obey it, and
// stop at the first year that breaks. `score` is that count, `of` is how many
// years the cohort spans.
//
// Cohorts whose changes don't follow a weekly pattern (lunar/Ramadan-based like
// Africa/Casablanca, or otherwise arbitrary) get `null` — left blank.

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th"]

const ruleText = (r) =>
  `${r.week === "last" ? "last" : ORDINALS[r.week]} ${r.weekday} of ${r.month}`

// Does one year's label satisfy a candidate rule?
function matches(label, rule) {
  if (!label) return false
  if (label.month !== rule.month || label.day !== rule.weekday) return false
  return rule.week === "last" ? label.last === true : label.nth === rule.week
}

// Consecutive most-recent years (from the end of `labels`) that match the rule.
function countBack(labels, rule) {
  let n = 0
  for (let i = labels.length - 1; i >= 0; i--) {
    if (!matches(labels[i], rule)) break
    n++
  }
  return n
}

// Best rule for a column of yearly labels (all the starts, or all the ends),
// or null when no weekly pattern fits.
function deriveRule(labels) {
  const latest = labels[labels.length - 1]
  if (!latest) return null

  // Candidate rules from the latest year: the fixed-week reading, and — when
  // that year is the last weekday of its month — the "last weekday" reading.
  const candidates = [{ month: latest.month, weekday: latest.day, week: latest.nth }]
  if (latest.last) candidates.push({ month: latest.month, weekday: latest.day, week: "last" })

  let best = null
  for (const rule of candidates) {
    const score = countBack(labels, rule)
    // Prefer higher coverage; on a tie prefer the "last weekday" phrasing, since
    // it's the stable intent behind rules whose week-number drifts year to year.
    const better =
      !best || score > best.score || (score === best.score && rule.week === "last")
    if (better) best = { ...rule, score }
  }

  // A rule that only holds for its own defining year isn't a pattern.
  if (best.score < 2) return null
  return { text: ruleText(best), month: best.month, weekday: best.weekday, week: best.week, score: best.score, of: labels.length }
}

// Attach start/end rules to every cohort.
const deriveRules = (cohorts) =>
  cohorts.map((c) => ({
    zoneCount: c.timezones.length,
    start: deriveRule(c.changes.map((x) => x.startLabel)),
    end: deriveRule(c.changes.map((x) => x.endLabel)),
    timezones: c.timezones,
  }))

export default deriveRules
