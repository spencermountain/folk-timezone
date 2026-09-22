import test from 'tape'
import getCohorts from '../src/02-cohorts.js'

const row = (year, start = '03-10', end = '11-03', offset = 0) => ({ year, start, end, offset })
const zone = (years, active = true) => ({ active, years })

test('cohorts group identical dates regardless of UTC offset and sort their members', (t) => {
  const data = {
    Zebra: zone([row(2024, undefined, undefined, -5)]),
    Alpha: zone([row(2024, undefined, undefined, 2)]),
    Other: zone([row(2024, '03-31', '10-27')])
  }
  const original = structuredClone(data)
  t.deepEqual(getCohorts(data), [
    { timezones: ['Alpha', 'Zebra'], changes: [{ year: 2024, start: '03-10', end: '11-03' }] },
    { timezones: ['Other'], changes: [{ year: 2024, start: '03-31', end: '10-27' }] }
  ])
  t.deepEqual(data, original)
  t.end()
})

test('cohort window uses only the most recent years', (t) => {
  const data = {
    A: zone([row(2023, '03-12'), row(2024)]),
    B: zone([row(2023, '03-26'), row(2024)])
  }
  t.equal(getCohorts(data).length, 2)
  t.deepEqual(getCohorts(data, 1), [{
    timezones: ['A', 'B'], changes: [{ year: 2024, start: '03-10', end: '11-03' }]
  }])
  t.end()
})

test('inactive zones and windows without changes are excluded; one-sided changes remain', (t) => {
  const data = {
    Inactive: zone([row(2024)], false),
    Fixed: zone([row(2024, null, null)]),
    Empty: zone([]),
    Older: zone([row(2023), row(2024, null, null)]),
    OneSided: zone([row(2024, null, '11-03')])
  }
  t.deepEqual(getCohorts(data, 1), [{
    timezones: ['OneSided'], changes: [{ year: 2024, start: null, end: '11-03' }]
  }])
  t.deepEqual(getCohorts({}), [])
  t.end()
})

test('equally sized cohorts sort by their first timezone', (t) => {
  const result = getCohorts({ Zebra: zone([row(2024)]), Alpha: zone([row(2024, '03-31')]) })
  t.deepEqual(result.map((cohort) => cohort.timezones), [['Alpha'], ['Zebra']])
  t.end()
})
