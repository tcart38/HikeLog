"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import "./map.css"

import * as React from "react"
import { useTheme } from "next-themes"
import * as ml from "maplibre-gl"

import { DARK_STYLE, LIBERTY_STYLE, boundsOf, themeColors, type Feature, type Geometry } from "@/components/map/map-utils"

/** Small, non-interactive map of one hike's GPS track. Attribution stays visible. */
// Served from /public by scripts/sync-maplibre.mjs (bundled workers are unreliable).
ml.setWorkerUrl("/maplibre-gl-worker.mjs")

export default function HikeMap({ geojson, styleUrl, color }: { geojson: Geometry; styleUrl: string | null; color?: string }) {
  const el = React.useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  React.useEffect(() => {
    if (!el.current) return
    const b = boundsOf(geojson)
    const map = new ml.Map({
      container: el.current,
      style: styleUrl || (dark ? DARK_STYLE : LIBERTY_STYLE),
      bounds: b ?? undefined,
      fitBoundsOptions: { padding: 28, maxZoom: 15 },
      interactive: false,
      attributionControl: false,
    })
    map.addControl(new ml.AttributionControl({ compact: false }), "bottom-right")
    map.on("style.load", () => {
      const c = themeColors()
      const feature: Feature = { type: "Feature", properties: {}, geometry: geojson }
      map.addSource("track", { type: "geojson", data: feature as never })
      map.addLayer({ id: "track-casing", type: "line", source: "track", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": dark ? "#101410" : "#ffffff", "line-width": 6, "line-opacity": 0.8 } })
      map.addLayer({ id: "track", type: "line", source: "track", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color || c.primary, "line-width": 3 } })
    })
    const ro = new ResizeObserver(() => {
      map.resize()
      if (b) map.fitBounds(b, { padding: 28, maxZoom: 15, duration: 0 })
    })
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      map.remove()
    }
  }, [geojson, styleUrl, dark, color])

  return <div ref={el} className="size-full" role="img" aria-label="Map of this hike's GPS track" />
}
