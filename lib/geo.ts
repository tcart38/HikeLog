/**
 * Small geometry toolkit for tracks and trail networks. Pure functions, no dependencies, client-safe.
 * Positions are GeoJSON order: [lon, lat]. Distances are metres unless a name says otherwise.
 */

export type Pos = [number, number]
export type Line = Pos[]
/** [minLon, minLat, maxLon, maxLat] */
export type BBox = [number, number, number, number]

const R = 6371008.8
const rad = (d: number) => (d * Math.PI) / 180
export const M_PER_MI = 1609.344

export function haversine(a: Pos, b: Pos): number {
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function lineLength(l: Line): number {
  let m = 0
  for (let i = 1; i < l.length; i++) m += haversine(l[i - 1], l[i])
  return m
}

export const linesLength = (ls: Line[]) => ls.reduce((a, l) => a + lineLength(l), 0)

export function bboxOf(lines: Line[]): BBox | null {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity
  for (const l of lines)
    for (const [x, y] of l) {
      if (x < minLon) minLon = x
      if (x > maxLon) maxLon = x
      if (y < minLat) minLat = y
      if (y > maxLat) maxLat = y
    }
  return minLon === Infinity ? null : [minLon, minLat, maxLon, maxLat]
}

export const round5 = (n: number) => Math.round(n * 1e5) / 1e5

/** Round to ~1 m and drop consecutive duplicates. */
export function cleanLine(l: Line): Line {
  const out: Line = []
  for (const [x, y] of l) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(y) > 90 || Math.abs(x) > 180) continue
    const p: Pos = [round5(x), round5(y)]
    const last = out[out.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p)
  }
  return out
}

/** Douglas-Peucker in a local flat projection. Iterative, so 100k-point tracks are fine. */
export function simplify(line: Line, toleranceM: number): Line {
  const n = line.length
  if (n < 3) return line.slice()
  const lat0 = line[Math.floor(n / 2)][1]
  const kx = Math.cos(rad(lat0)) * 111320
  const ky = 110574
  const xs = line.map((p) => p[0] * kx)
  const ys = line.map((p) => p[1] * ky)
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    let maxD = 0
    let idx = -1
    const dx = xs[b] - xs[a]
    const dy = ys[b] - ys[a]
    const len2 = dx * dx + dy * dy
    for (let i = a + 1; i < b; i++) {
      let d: number
      if (len2 === 0) d = Math.hypot(xs[i] - xs[a], ys[i] - ys[a])
      else {
        const t = Math.max(0, Math.min(1, ((xs[i] - xs[a]) * dx + (ys[i] - ys[a]) * dy) / len2))
        d = Math.hypot(xs[i] - (xs[a] + t * dx), ys[i] - (ys[a] + t * dy))
      }
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx >= 0 && maxD > toleranceM) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  return line.filter((_, i) => keep[i])
}

/** Insert points so no step is longer than maxStepM. */
export function densify(line: Line, maxStepM: number): Line {
  const out: Line = []
  for (let i = 0; i < line.length; i++) {
    out.push(line[i])
    if (i === line.length - 1) break
    const d = haversine(line[i], line[i + 1])
    if (d > maxStepM) {
      const k = Math.ceil(d / maxStepM)
      for (let j = 1; j < k; j++) {
        const t = j / k
        out.push([line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t])
      }
    }
  }
  return out
}

/** The part of a line between two distances along it. */
export function sliceLine(line: Line, fromM: number, toM: number): Line {
  const out: Line = []
  let acc = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const b = line[i]
    const d = haversine(a, b)
    const s = acc
    const e = acc + d
    acc = e
    if (e < fromM) continue
    if (s > toM) break
    const pt = (m: number): Pos => {
      const t = d === 0 ? 0 : (m - s) / d
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    if (!out.length) out.push(s >= fromM ? a : pt(fromM))
    out.push(e <= toM ? b : pt(toM))
  }
  return out
}

/** Cut a line into n roughly equal pieces of about targetM each (at least one). */
export function splitLine(line: Line, targetM: number): Line[] {
  const len = lineLength(line)
  const n = Math.max(1, Math.round(len / targetM))
  if (n === 1) return [line]
  const out: Line[] = []
  for (let i = 0; i < n; i++) {
    const piece = sliceLine(line, (len * i) / n, (len * (i + 1)) / n)
    if (piece.length >= 2) out.push(piece)
  }
  return out
}

/** Evenly spaced sample points along a line, endpoints included, at most stepM apart. */
export function samplePoints(line: Line, stepM: number): Pos[] {
  return densify(line, stepM)
}

/** Spatial hash of points for "is anything within r metres?" queries. */
export class PointIndex {
  private cells = new Map<string, Pos[]>()
  private cellLat: number
  private cellLon: number
  private kx: number
  constructor(points: Pos[], private radiusM: number) {
    const lat0 = points.length ? points[Math.floor(points.length / 2)][1] : 45
    this.kx = Math.cos(rad(lat0)) * 111320
    this.cellLat = radiusM / 110574
    this.cellLon = radiusM / this.kx
    for (const p of points) {
      const k = this.key(Math.floor(p[0] / this.cellLon), Math.floor(p[1] / this.cellLat))
      const c = this.cells.get(k)
      if (c) c.push(p)
      else this.cells.set(k, [p])
    }
  }
  private key(cx: number, cy: number) {
    return `${cx},${cy}`
  }
  near(p: Pos): boolean {
    const cx = Math.floor(p[0] / this.cellLon)
    const cy = Math.floor(p[1] / this.cellLat)
    const r2 = this.radiusM * this.radiusM
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const c = this.cells.get(this.key(cx + dx, cy + dy))
        if (!c) continue
        for (const q of c) {
          const x = (q[0] - p[0]) * this.kx
          const y = (q[1] - p[1]) * 110574
          if (x * x + y * y <= r2) return true
        }
      }
    return false
  }
}

// ---------- parsing ----------

const attr = (s: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(s)?.[1]

/** GPX -> one line per track segment (falls back to routes, then bare waypoints). */
export function parseGpxLines(xml: string): Line[] {
  const lines: Line[] = []
  const ptRe = /<(trkpt|rtept)\b([^>]*?)(\/>|>)/g
  const grab = (chunk: string): Line => {
    const out: Line = []
    let m: RegExpExecArray | null
    ptRe.lastIndex = 0
    while ((m = ptRe.exec(chunk))) {
      const lat = Number(attr(m[2], "lat"))
      const lon = Number(attr(m[2], "lon"))
      if (Number.isFinite(lat) && Number.isFinite(lon) && attr(m[2], "lat") != null && attr(m[2], "lon") != null) out.push([lon, lat])
    }
    return out
  }
  for (const tag of ["trkseg", "rte"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g")
    let m: RegExpExecArray | null
    while ((m = re.exec(xml))) {
      const l = grab(m[1])
      if (l.length >= 2) lines.push(l)
    }
    if (lines.length) break
  }
  return lines
}

/** GeoJSON (Geometry, Feature or FeatureCollection) -> lines. Ignores points and polygons. */
export function parseGeoJsonLines(g: unknown): Line[] {
  const out: Line[] = []
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return
    const x = o as { type?: string; coordinates?: unknown; geometry?: unknown; features?: unknown[]; geometries?: unknown[] }
    if (x.type === "FeatureCollection") x.features?.forEach(walk)
    else if (x.type === "Feature") walk(x.geometry)
    else if (x.type === "GeometryCollection") x.geometries?.forEach(walk)
    else if (x.type === "LineString") out.push(toLine(x.coordinates))
    else if (x.type === "MultiLineString" && Array.isArray(x.coordinates)) for (const c of x.coordinates) out.push(toLine(c))
  }
  walk(g)
  return out.filter((l) => l.length >= 2)
}

function toLine(c: unknown): Line {
  if (!Array.isArray(c)) return []
  const out: Line = []
  for (const p of c) if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push([Number(p[0]), Number(p[1])])
  return out
}

/** Lines -> a GeoJSON geometry (LineString for one line, MultiLineString for several). */
export function toGeometry(lines: Line[]): { type: "LineString"; coordinates: Line } | { type: "MultiLineString"; coordinates: Line[] } {
  return lines.length === 1 ? { type: "LineString", coordinates: lines[0] } : { type: "MultiLineString", coordinates: lines }
}

export function fromGeometry(g: unknown): Line[] {
  return parseGeoJsonLines(g)
}
