/** Shared client helpers for the MapLibre maps. */

export const LIBERTY_STYLE = "https://tiles.openfreemap.org/styles/liberty"
export const DARK_STYLE = "https://tiles.openfreemap.org/styles/dark"

/** Keyless topo-ish raster basemap. OpenTopoMap asks for visible attribution; MapLibre's attribution control shows it. */
export const TOPO_STYLE = {
  version: 8,
  sources: {
    topo: {
      type: "raster",
      tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 17,
      attribution:
        'Map data: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, SRTM | Style: © <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC-BY-SA</a>)',
    },
  },
  layers: [{ id: "topo", type: "raster", source: "topo" }],
} as const

export type Basemap = "streets" | "topo"

/** Distinct, map-legible person colours used when a person has none of their own. */
const FALLBACK = ["#2563eb", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#65a30d", "#7c3aed"]
export const personColor = (color: string | null | undefined, index: number) => color || FALLBACK[index % FALLBACK.length]

let ctx: CanvasRenderingContext2D | null = null

/**
 * Resolve any CSS colour (including oklch theme tokens, which MapLibre cannot parse) to an rgb() string
 * by painting one pixel and reading it back.
 */
export function cssColor(value: string, fallback = "#16a34a"): string {
  if (typeof document === "undefined") return fallback
  ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true })
  if (!ctx) return fallback
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = value
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
}

/** Theme tokens as map-ready colours. */
export function themeColors() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string, fb: string) => cssColor(s.getPropertyValue(name).trim() || fb, fb)
  const dark = document.documentElement.classList.contains("dark")
  return {
    dark,
    primary: v("--done", "#16a34a"),
    muted: v("--muted-foreground", "#8a8a7a"),
    remaining: v("--remaining-foreground", "#92400e"),
    foreground: v("--foreground", "#111"),
    background: v("--background", "#fff"),
  }
}
export type ThemeColors = ReturnType<typeof themeColors>

/** Minimal GeoJSON shapes (the project has no @types/geojson). */
export type Geometry = { type: string; coordinates?: unknown; geometries?: Geometry[] }
export type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry }
export type FC = { type: "FeatureCollection"; features: Feature[] }
export const emptyFC: FC = { type: "FeatureCollection", features: [] }

export function boundsOf(g: Geometry | Feature | FC): [[number, number], [number, number]] | null {
  let minX = 180
  let minY = 90
  let maxX = -180
  let maxY = -90
  let any = false
  const visit = (c: unknown) => {
    if (!Array.isArray(c)) return
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      any = true
      if (c[0] < minX) minX = c[0]
      if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]
      if (c[1] > maxY) maxY = c[1]
    } else for (const x of c) visit(x)
  }
  const walk = (o: Geometry | Feature | FC) => {
    if (o.type === "FeatureCollection") (o as FC).features.forEach(walk)
    else if (o.type === "Feature") walk((o as Feature).geometry)
    else if (o.type === "GeometryCollection") (o as Geometry).geometries?.forEach(walk)
    else visit((o as Geometry).coordinates)
  }
  walk(g)
  return any ? [[minX, minY], [maxX, maxY]] : null
}
