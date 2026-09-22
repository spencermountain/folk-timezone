import { readFileSync } from 'node:fs'
import test from 'tape'
import labelCohorts from '../src/03-labels.js'
import deriveRules from '../src/04-rules.js'

const readData = (name) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))
const cohorts = readData('cohorts')
const rules = readData('rules')

test('saved cohorts have unique zones and consecutive yearly histories', (t) => {
  t.ok(cohorts.length > 0)
  const zones = new Set()
  for (const cohort of cohorts) {
    t.ok(cohort.timezones.length > 0)
    t.deepEqual(cohort.timezones, [...cohort.timezones].sort())
    for (const zone of cohort.timezones) {
      t.equal(zones.has(zone), false, `duplicate zone: ${zone}`)
      zones.add(zone)
    }
    t.ok(cohort.changes.length > 0)
    cohort.changes.forEach((change, index) => {
      t.ok(Number.isInteger(change.year))
      if (index > 0) t.equal(change.year, cohort.changes[index - 1].year + 1)
      for (const field of ['start', 'end']) {
        if (change[field] === null) continue
        t.match(change[field], /^\d{2}-\d{2}$/)
        const iso = `${change.year}-${change[field]}`
        t.equal(new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10), iso)
      }
    })
  }
  t.end()
})

test('saved calendar labels and rules reproduce from the saved transition dates', (t) => {
  t.deepEqual(labelCohorts(cohorts), cohorts)
  t.deepEqual(deriveRules(cohorts), rules)
  t.end()
})

test('saved European results retain the last-Sunday rules across the full history', (t) => {
  const europe = rules.find((rule) => rule.timezones.includes('Europe/London'))
  t.ok(europe)
  t.equal(europe.start.text, 'last Sunday of March')
  t.equal(europe.end.text, 'last Sunday of October')
  t.equal(europe.start.score, europe.start.of)
  t.equal(europe.end.score, europe.end.of)
  t.equal(europe.zoneCount, europe.timezones.length)
  t.end()
})
