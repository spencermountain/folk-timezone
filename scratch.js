import spacetime from "spacetime"
import fs from "fs"

const timezones = spacetime.timezones()
let out = Object.keys(timezones).map(tz => {
  let obj = timezones[tz]
  obj.name = tz
  delete obj.hem
  return obj
}).filter(obj => {
  return obj.dst && obj.name.match('/')
});
fs.writeFileSync("dst-timezones.json", JSON.stringify(out, null, 2));