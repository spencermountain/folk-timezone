// import folkDst from "./src/index.js"
// let data = folkDst()
// console.log(data)

import spacetime from "spacetime"
import fs from "fs"
let data = fs.readFileSync("data/cohorts.json", "utf8")
data = JSON.parse(data)

let cohort = data[5]
const which = 'start'
cohort.changes.forEach(change => {
  console.log(change.year, change[which], change[which + 'Label'])
})