// End-to-end test of the Garmin import against a mocked Garmin server.
// Usage: start the app with GARMIN_TOKEN_URL=http://127.0.0.1:3399/token GARMIN_API_BASE=http://127.0.0.1:3399
//   (and a fresh DATA_DIR) on APP=http://localhost:3300, then: node scripts/garmin-mock-test.mjs
import http from "node:http"
import assert from "node:assert/strict"

const APP = process.env.APP || "http://localhost:3300"
const KEY = "test-key-1234567890"
const log = []

function gpx(points) {
  return `<?xml version="1.0"?><gpx><trk><trkseg>${points.map(([la, lo, e]) => `<trkpt lat="${la}" lon="${lo}"><ele>${e}</ele></trkpt>`).join("")}</trkseg></trk></gpx>`
}
// Walk up to Washington (44.2706,-71.3033; 1917 m) and back.
const track = []
for (let i = 0; i <= 20; i++) track.push([44.2706 - 0.02 + i * 0.001, -71.3033 + 0.015 - i * 0.00075, 600 + i * 66])
track.push([44.27062, -71.30328, 1916])
const ACTIVITIES = [
  { activityId: 9001, activityName: "Mount Washington", startTimeLocal: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) + " 07:30:00", activityType: { typeKey: "hiking" }, distance: 15000, elevationGain: 1250, duration: 25200, startLatitude: 44.25, startLongitude: -71.29 },
  { activityId: 9002, activityName: "Morning walk", startTimeLocal: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) + " 07:30:00", activityType: { typeKey: "walking" }, distance: 3000, elevationGain: 10, duration: 2400 },
  { activityId: 9003, activityName: "Lafayette & Lincoln", startTimeLocal: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10) + " 08:00:00", activityType: { typeKey: "hiking" }, distance: 14000, elevationGain: 1100, duration: 22000 },
]

const mock = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x")
  log.push(`${req.method} ${url.pathname}`)
  if (url.pathname === "/token") {
    if (req.headers.authorization !== `ApiKey ${KEY}`) return res.writeHead(401).end()
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ access_token: "at-" + Date.now(), expires_in: 86400 }))
  }
  if (req.headers.authorization?.startsWith("Bearer at-") !== true) return res.writeHead(401).end()
  if (url.pathname === "/activitylist-service/activities/search/activities") {
    const start = Number(url.searchParams.get("start") || 0)
    return res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(start === 0 ? ACTIVITIES : []))
  }
  const m = url.pathname.match(/^\/download-service\/export\/gpx\/activity\/(\d+)$/)
  if (m) return m[1] === "9001" ? res.writeHead(200, { "content-type": "application/gpx+xml" }).end(gpx(track)) : res.writeHead(404).end()
  res.writeHead(404).end()
})
await new Promise((r) => mock.listen(3399, "127.0.0.1", r))

let cookie = ""
async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(APP + path, { method, headers: { "content-type": "application/json", cookie, origin: APP }, body: body === undefined ? undefined : JSON.stringify(body) })
  const sc = res.headers.get("set-cookie")
  if (sc) cookie = sc.split(";")[0]
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

try {
  const user = "garmin" + Date.now().toString(36)
  let r = await call("/api/auth/signup", { method: "POST", body: { username: user, password: "correct-horse-1", displayName: "Garmin Tester" } })
  assert.equal(r.status, 201, "signup " + JSON.stringify(r.data))

  r = await call("/api/v1/garmin/connection")
  assert.equal(r.data.connected, false)
  r = await call("/api/v1/garmin/connection", { method: "PUT", body: { apiKey: "wrong-key-123456" } })
  assert.equal(r.status, 422, "bad key rejected")
  r = await call("/api/v1/garmin/connection", { method: "PUT", body: { apiKey: KEY } })
  assert.equal(r.status, 200)
  assert.equal(r.data.connected, true)
  assert.ok(!JSON.stringify(r.data).includes(KEY), "key never returned")

  r = await call("/api/v1/garmin/sync", { method: "POST", body: {} })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.added, 2, "walking filtered out")
  r = await call("/api/v1/garmin/sync", { method: "POST", body: {} })
  assert.equal(r.data.added, 0, "second sync adds nothing")

  r = await call("/api/v1/garmin/activities?status=pending")
  const acts = r.data.activities
  assert.equal(acts.length, 2)
  const wash = acts.find((a) => a.activityId === "9001")
  const laf = acts.find((a) => a.activityId === "9003")
  assert.ok(wash.suggestedPeaks.some((p) => p.slug.includes("washington") && p.reason === "track"), "Washington suggested from track: " + JSON.stringify(wash.suggestedPeaks))
  assert.ok(laf.suggestedPeaks.some((p) => /lafayette/i.test(p.name) && p.reason === "title"), "Lafayette from title")
  assert.ok(Math.abs(wash.distanceMi - 9.32) < 0.05)

  r = await call(`/api/v1/garmin/activities/${wash.id}/import`, { method: "POST", body: { notes: "from test" } })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  assert.equal(r.data.hike.externalId, "garmin:9001")
  assert.ok(r.data.hike.peaks.some((p) => /washington/i.test(p.name)))
  assert.equal(r.data.hike.source, "api")
  r = await call(`/api/v1/garmin/activities/${laf.id}/ignore`, { method: "POST", body: {} })
  assert.equal(r.data.activity.status, "ignored")

  r = await call("/api/v1/hikes?q=Washington")
  assert.ok(r.data.hikes.some((h) => h.externalId === "garmin:9001"), "hike listed")
  r = await call("/api/v1/garmin/activities?status=pending")
  assert.equal(r.data.activities.length, 0)

  // isolation: a second user sees nothing of the first
  const saved = cookie
  cookie = ""
  r = await call("/api/auth/signup", { method: "POST", body: { username: user + "b", password: "correct-horse-1" } })
  if (r.status === 201) {
    r = await call("/api/v1/garmin/activities")
    assert.equal(r.data.activities.length, 0, "other user's inbox empty")
    r = await call(`/api/v1/garmin/activities/${wash.id}/ignore`, { method: "POST", body: {} })
    assert.equal(r.status, 404, "cannot touch another user's activity")
  } else console.log("(signup closed for 2nd user; isolation check skipped)")
  cookie = saved

  r = await call("/api/v1/garmin/connection", { method: "DELETE" })
  assert.equal(r.status, 200)
  console.log("ALL PASSED. mock calls:", log.length)
} catch (e) {
  console.error("FAILED:", e.message)
  process.exitCode = 1
} finally {
  mock.close()
}
