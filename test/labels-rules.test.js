import test from 'tape'
import labelCohorts, { labelDate, describe } from '../src/03-labels.js'
import deriveRules from '../src/04-rules.js'

test('calendar labels distinguish ordinal weeks, last weekdays, and leap days', (t) => {
  for (const [year, date, month, day, nth, last] of [
    [2024, '03-10', 'March', 'Sunday', 2, false],
    [2024, '03-31', 'March', 'Sunday', 5, true],
    [2025, '03-30', 'March', 'Sunday', 5, true],
    [2023, '03-26', 'March', 'Sunday', 4, true],
    [2024, '02-29', 'February', 'Thursday', 5, true],
    [2023, '02-28', 'February', 'Tuesday', 4, true],
    [2024, '12-31', 'December', 'Tuesday', 5, true]
  ]) {
    t.deepEqual(labelDate(year, date), { month, day, nth, last }, `${year}-${date}`)
  }
  t.equal(labelDate(2024, null), null)
  t.end()
})

test('labeling preserves source data and absent transitions', (t) => {
  const input = [{ timezones: ['Example'], changes: [{ year: 2024, start: '03-10', end: null }] }]
  const original = structuredClone(input)
  const result = labelCohorts(input)
  t.deepEqual(input, original)
  t.notEqual(result[0].changes[0], input[0].changes[0])
  t.deepEqual(result[0].changes[0].startLabel, {
    month: 'March', day: 'Sunday', nth: 2, last: false
  })
  t.equal(result[0].changes[0].endLabel, null)
  t.end()
})

test('descriptions distinguish fixed, last, varying-week, and irregular patterns', (t) => {
  const labels = (dates) => dates.map((date) => labelDate(2024, date))
  t.equal(describe([null]), '—')
  t.equal(describe([]), '—')
  t.equal(describe(labels(['03-10', null, '03-10'])), '2nd Sunday of March')
  t.equal(describe([labelDate(2023, '03-26'), labelDate(2024, '03-31')]), 'last Sunday of March')
  t.equal(describe(labels(['03-10', '03-17'])), 'Sunday of March (week varies)')
  t.equal(describe(labels(['03-10', '04-14'])), 'varies')
  t.equal(describe(labels(['03-10', '03-11'])), 'varies')
  t.end()
})

const rulesFor = (dates) => deriveRules(labelCohorts([{
  timezones: ['Example'],
  changes: dates.map((start, index) => ({ year: 2020 + index, start, end: null }))
}]))[0]

test('rules score only consecutive recent matching years, stopping at a mismatch or gap', (t) => {
  for (const older of ['03-21', null]) {
    const result = rulesFor(['03-08', older, '03-13', '03-12', '03-10'])
    t.deepEqual(result.start, {
      text: '2nd Sunday of March', month: 'March', weekday: 'Sunday', week: 2, score: 3, of: 5
    })
    t.equal(result.end, null)
    t.equal(result.zoneCount, 1)
    t.deepEqual(result.timezones, ['Example'])
  }
  t.end()
})

test('last-weekday rules beat drifting ordinals and win ties', (t) => {
  const drifting = rulesFor(['03-29', '03-28', '03-27', '03-26', '03-31'])
  t.equal(drifting.start.week, 'last')
  t.equal(drifting.start.score, 5)
  const tied = rulesFor(['04-26', '04-25'])
  t.equal(tied.start.week, 'last')
  t.equal(tied.start.score, 2)
  t.end()
})

test('rules require at least two matching years and an existing latest transition', (t) => {
  for (const dates of [[], ['03-29'], ['03-29', '04-04'], ['03-29', null]]) {
    t.equal(rulesFor(dates).start, null)
  }
  t.deepEqual(deriveRules([]), [])
  t.end()
})
