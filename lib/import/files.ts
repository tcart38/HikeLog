import "server-only"
import crypto from "node:crypto"
import FitParser from "fit-file-parser"
import { ApiError } from "../api"
import { haversine } from "../geo"
import type { GarminActivity, TrackPoint } from "../garmin/client"
import { MAX_TRACK_BYTES } from "../tracks"
import { addToInbox } from "./inbox"

type Pt = TrackPoint & { t: number | null }

const M_TO_MI = 0.000621371
const M_TO_FT = 3.28084

function localDate(ms: number): string {
  const tz = process.env.APP_TIMEZONE || "America/New_York"
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms))
}

function parseGpxPoints(xml: string): Pt[] {
  const pts: Pt[] = []
  const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const lat = /\blat\s*=\s*["'](-?[\d.]+)["']/.exec(m[1])
    const lon = /\blon\s*=\s*["'](-?[\d.]+)["']/.exec(m[1])
    if (!lat || !lon) continue
    const ele = /<ele>\s*(-?[\d.]+)\s*<\/ele>/.exec(m[2] ?? "")
    const time = /<time>\s*([^<\s]+)\s*<\/time>/.exec(m[2] ?? "")
    const t = time ? Date.parse(time[1]) : NaN
    pts.push({ lat: Number(lat[1]), lon: Number(lon[1]), eleM: ele ? Number(ele[1]) : null, t: Number.isFinite(t) ? t : null })
  }
  return pts
}

async function parseFitPoints(buf: Buffer): Promise<{ pts: Pt[]; sport: string | null; startMs: number | null }> {
  let fit
  try {
    fit = await new FitParser({ force: true, lengthUnit: "m" }).parseAsync(buf as Buffer<ArrayBuffer>)
  } catch {
    throw new ApiError("Could not read that FIT file. Is it a complete activity file?", 422)
  }
  const pts: Pt[] = []
  for (const r of fit.records ?? []) {
    if (typeof r.position_lat !== "number" || typeof r.position_long !== "number") continue
    const alt = typeof r.enhanced_altitude === "number" ? r.enhanced_altitude : typeof r.altitude === "number" ? r.altitude : null
    const ts = r.timestamp instanceof Date ? r.timestamp.getTime() : null
    pts.push({ lat: r.position_lat, lon: r.position_long, eleM: alt, t: ts })
  }
  const s = fit.sessions?.[0] as { sport?: string; start_time?: Date } | undefined
  return { pts, sport: s?.sport ?? null, startMs: s?.start_time instanceof Date ? s.start_time.getTime() : null }
}

/** Summary stats from points. Elevation gain ignores wiggles under 3 m so GPS noise doesn't inflate it. */
function stats(pts: Pt[]) {
  let dist = 0
  for (let i = 1; i < pts.length; i++) dist += haversine([pts[i - 1].lon, pts[i - 1].lat], [pts[i].lon, pts[i].lat])
  let gain = 0
  let ref: number | null = null
  const hasEle = pts.some((p) => p.eleM != null)
  for (const p of pts) {
    if (p.eleM == null) continue
    if (ref == null) ref = p.eleM
    else if (p.eleM - ref >= 3) {
      gain += p.eleM - ref
      ref = p.eleM
    } else if (p.eleM < ref) ref = p.eleM
  }
  const times = pts.map((p) => p.t).filter((t): t is number => t != null)
  const durMin = times.length > 1 ? Math.round((times[times.length - 1] - times[0]) / 60_000) : null
  return { distMi: Math.round(dist * M_TO_MI * 100) / 100, gainFt: hasEle ? Math.round(gain * M_TO_FT) : null, durMin, startMs: times[0] ?? null }
}

export type FileResult = { name: string; status: "added" | "duplicate" | "error"; message?: string }

export async function importFile(userId: number, filename: string, buf: Buffer): Promise<FileResult> {
  const name = filename || "activity"
  try {
    if (buf.length > MAX_TRACK_BYTES) throw new ApiError("File is larger than 25 MB", 413)
    const lower = name.toLowerCase()
    let pts: Pt[]
    let title: string | null = null
    let startMs: number | null = null
    if (lower.endsWith(".fit") || (buf.length > 12 && buf.subarray(8, 12).toString("latin1") === ".FIT")) {
      const f = await parseFitPoints(buf)
      pts = f.pts
      startMs = f.startMs
    } else if (lower.endsWith(".gpx") || /<gpx[\s>]/i.test(buf.subarray(0, 4096).toString("utf8"))) {
      const xml = buf.toString("utf8")
      pts = parseGpxPoints(xml)
      title = /<trk>[\s\S]*?<name>\s*([^<]+?)\s*<\/name>/i.exec(xml)?.[1] ?? /<metadata>[\s\S]*?<name>\s*([^<]+?)\s*<\/name>/i.exec(xml)?.[1] ?? null
    } else throw new ApiError("Unsupported file type. Upload .gpx or .fit files.", 415)
    if (pts.length < 2) throw new ApiError("No GPS track found in that file", 422)
    const st = stats(pts)
    const ms = startMs ?? st.startMs ?? Date.now()
    const a: GarminActivity = {
      activityId: `file:${crypto.createHash("sha256").update(buf).digest("hex").slice(0, 20)}`,
      name: (title ?? name.replace(/\.[^.]+$/, "")).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").slice(0, 200),
      type: "hiking",
      startDate: localDate(ms),
      distanceMi: st.distMi,
      elevationGainFt: st.gainFt,
      durationMin: st.durMin,
      startLat: pts[0].lat,
      startLon: pts[0].lon,
      endLat: pts[pts.length - 1].lat,
      endLon: pts[pts.length - 1].lon,
      raw: { file: name, bytes: buf.length, points: pts.length },
    }
    return { name, status: addToInbox(userId, "file", a, pts) ? "added" : "duplicate" }
  } catch (e) {
    if (e instanceof ApiError) return { name, status: "error", message: e.message }
    return { name, status: "error", message: e instanceof Error ? e.message : String(e) }
  }
}
