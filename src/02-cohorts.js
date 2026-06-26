// Group IANA time zones into cohorts that share identical DST change dates
// over the last N years. Only the start/end days matter — offset is ignored.
// Pretty-prints the cohorts to the console and writes data/cohorts.json.

const getCohorts = (data, matchYears = Infinity) => {
  // Reduce each zone to the start/end dates of its most recent N years.
  function changesOf(zone) {
    const years = data[zone].years
    const window = Number.isFinite(matchYears) ? years.slice(-matchYears) : years
    return window.map((r) => ({ year: r.year, start: r.start, end: r.end }))
  }

  // Bucket zones by the exact sequence of (year, start, end) — that string is
  // the cohort's identity. Skip inactive zones and zones that never change their
  // clocks within the window.
  const buckets = new Map()
  for (const zone of Object.keys(data)) {
    if (!data[zone].active) continue
    const changes = changesOf(zone)
    if (changes.every((c) => c.start === null && c.end === null)) continue

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
    .sort(
      (a, b) =>
        b.timezones.length - a.timezones.length ||
        a.timezones[0].localeCompare(b.timezones[0]),
    )
  return cohorts
}
export default getCohorts