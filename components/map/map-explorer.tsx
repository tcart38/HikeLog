"use client"

import "maplibre-gl/dist/maplibre-gl.css"
import "./map.css"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import * as ml from "maplibre-gl"

import { BottomSheet, type SheetState } from "@/components/map/bottom-sheet"
import { DARK_STYLE, LIBERTY_STYLE, TOPO_STYLE, boundsOf, emptyFC, themeColors, type Basemap, type FC, type Feature, type ThemeColors } from "@/components/map/map-utils"
import { MapPanel, PanelSummary } from "@/components/map/map-panel"
import type { HikeOption, MapNetwork, MapPeak, MapPerson, TrackInfo, TrailInfo } from "@/components/map/types"
import { api } from "@/lib/client/api"

export type MapExplorerProps = {
  styleUrl: string | null
  people: MapPerson[]
  personId: number
  lists: { value: string; label: string }[]
  listSlug: string
  modes: { value: string; label: string }[]
  mode: string
  peaks: MapPeak[]
  peakTotal: number
  networks: MapNetwork[]
  networkSlug: string | null
  hikes: HikeOption[]
  isAdmin: boolean
  focusHike: number | null
}

export type Layers = { peaks: boolean; tracks: boolean; network: boolean }
export type SectionPick = { a: number | null; b: number | null } | null

// Served from /public by scripts/sync-maplibre.mjs (bundled workers are unreliable).
ml.setWorkerUrl("/maplibre-gl-worker.mjs")

const SRC = ["net", "tracks", "sel", "peaks"] as const
const LAYER_GROUPS: Record<keyof Layers, string[]> = {
  network: ["net-casing", "net-uncovered", "net-covered"],
  tracks: ["tracks-casing", "tracks"],
  peaks: ["peaks-halo", "peaks"],
}

function styleSpec(basemap: Basemap, styleUrl: string | null, dark: boolean): string | ml.StyleSpecification {
  if (basemap === "topo") return TOPO_STYLE as unknown as ml.StyleSpecification
  return styleUrl || (dark ? DARK_STYLE : LIBERTY_STYLE)
}

type Src = (typeof SRC)[number]

function applyVisibility(map: ml.Map, layers: Layers) {
  if (!map.getStyle()) return
  for (const [g, ids] of Object.entries(LAYER_GROUPS))
    for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", layers[g as keyof Layers] ? "visible" : "none")
}

function putData(map: ml.Map | null, store: Record<Src, FC>, id: Src, fc: FC) {
  store[id] = fc
  ;(map?.getSource(id) as ml.GeoJSONSource | undefined)?.setData(fc as never)
}

/** (Re)create the overlay sources and layers. Runs after every style load, so basemap swaps keep them. */
function installLayers(map: ml.Map, store: Record<Src, FC>, basemap: Basemap, layers: Layers) {
  if (!map.getStyle()) return
  const c: ThemeColors = themeColors()
  const darkBase = c.dark && basemap === "streets"
  const casing = darkBase ? "#101410" : "#ffffff"
  for (const id of SRC) if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: store[id] as never })
  const add = (l: ml.LayerSpecification) => {
    if (!map.getLayer(l.id)) map.addLayer(l)
  }
  const round = { "line-cap": "round", "line-join": "round" } as const
  const w = (a: number, b: number) => ["interpolate", ["linear"], ["zoom"], 8, a, 13, b] as ml.ExpressionSpecification
  add({ id: "net-casing", type: "line", source: "net", layout: round, paint: { "line-color": casing, "line-width": w(2.5, 6), "line-opacity": 0.75 } })
  add({ id: "net-uncovered", type: "line", source: "net", filter: ["==", ["get", "covered"], 0], layout: round, paint: { "line-color": c.muted, "line-width": w(1.2, 3), "line-opacity": 0.95 } })
  add({ id: "net-covered", type: "line", source: "net", filter: ["==", ["get", "covered"], 1], layout: round, paint: { "line-color": c.primary, "line-width": w(2.2, 4.5) } })
  add({ id: "sel-halo", type: "line", source: "sel", layout: round, paint: { "line-color": darkBase ? "#ffffff" : c.foreground, "line-width": 11, "line-opacity": 0.28 } })
  add({
    id: "sel-line",
    type: "line",
    source: "sel",
    layout: round,
    paint: { "line-color": ["case", ["==", ["get", "range"], 1], c.remaining, ["==", ["get", "covered"], 1], c.primary, c.muted], "line-width": 5 },
  })
  add({ id: "tracks-casing", type: "line", source: "tracks", layout: round, paint: { "line-color": casing, "line-width": 5, "line-opacity": 0.7 } })
  add({ id: "tracks", type: "line", source: "tracks", layout: round, paint: { "line-color": ["get", "color"], "line-width": 2.5 } })
  add({ id: "peaks-halo", type: "circle", source: "peaks", paint: { "circle-color": casing, "circle-opacity": 0.9, "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 5.5, 12, 11] } })
  add({
    id: "peaks",
    type: "circle",
    source: "peaks",
    paint: {
      "circle-color": ["case", ["==", ["get", "done"], 1], c.primary, "rgba(255,255,255,0.2)"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 3.5, 12, 8],
      "circle-stroke-color": ["case", ["==", ["get", "done"], 1], "#ffffff", c.remaining],
      "circle-stroke-width": ["case", ["==", ["get", "done"], 1], 1.5, 2.5],
    },
  })
  applyVisibility(map, layers)
}

function popupEl(title: string, lines: string[], link?: { href: string; label: string }, onNavigate?: (href: string) => void) {
  const root = document.createElement("div")
  root.style.minWidth = "9rem"
  const h = document.createElement("div")
  h.style.fontWeight = "600"
  h.textContent = title
  root.append(h)
  for (const l of lines) {
    const p = document.createElement("div")
    p.style.cssText = "font-size:12px;color:#555;margin-top:2px"
    p.textContent = l
    root.append(p)
  }
  if (link) {
    const a = document.createElement("a")
    a.href = link.href
    a.textContent = link.label
    a.style.cssText = "display:inline-block;margin-top:8px;font-size:13px"
    a.addEventListener("click", (e) => {
      if (onNavigate && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        onNavigate(link.href)
      }
    })
    root.append(a)
  }
  return root
}

export default function MapExplorer(props: MapExplorerProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const elRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<ml.Map | null>(null)
  const dataRef = React.useRef<Record<Src, FC>>({ net: emptyFC, tracks: emptyFC, sel: emptyFC, peaks: emptyFC })
  const popupRef = React.useRef<ml.Popup | null>(null)

  const [isDesktop, setIsDesktop] = React.useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches)
  const [sheet, setSheet] = React.useState<SheetState>("peek")
  const [basemap, setBasemap] = React.useState<Basemap>("streets")
  const [layers, setLayers] = React.useState<Layers>({ peaks: true, tracks: true, network: true })
  const [everyone, setEveryone] = React.useState(false)
  const [tracks, setTracks] = React.useState<TrackInfo[]>([])
  const [netResult, setNetResult] = React.useState<{ key: string; ok: boolean; count: number } | null>(null)
  const [trail, setTrail] = React.useState<TrailInfo | null>(null)
  const [section, setSection] = React.useState<SectionPick>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)

  const dark = resolvedTheme === "dark"
  const personColor = React.useMemo(() => new Map(props.people.map((p) => [p.id, p.color])), [props.people])

  // Latest values for the event handlers that are registered once with the map.
  const live = React.useRef({ props, section, trail, layers, basemap, isDesktop })
  React.useEffect(() => {
    live.current = { props, section, trail, layers, basemap, isDesktop }
  })

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const on = () => setIsDesktop(mq.matches)
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])

  const lastStyle = React.useRef<string>("")
  const focused = React.useRef(false)
  const flownTo = React.useRef<string | null>(null)

  const selectTrail = React.useCallback(async (id: number, personId: number) => {
    try {
      const t = await api<TrailInfo>(`/api/v1/trails/${id}/segments?person=${personId}`)
      setTrail(t)
      setSection(null)
      if (!live.current.isDesktop) setSheet((s) => (s === "peek" ? "half" : s))
    } catch {}
  }, [])

  // ---------- create the map once ----------
  React.useEffect(() => {
    const el = elRef.current
    if (!el) return
    const p = live.current.props
    const bounds = p.peaks.length
      ? boundsOf({ type: "FeatureCollection", features: p.peaks.map((k) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [k.lon, k.lat] } })) })
      : null
    const map = new ml.Map({
      container: el,
      style: styleSpec("streets", p.styleUrl, document.documentElement.classList.contains("dark")),
      center: [-71.4, 44.0],
      zoom: 7,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
    })
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    map.addControl(new ml.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }), "top-right")
    map.addControl(new ml.ScaleControl({ unit: "imperial" }), "top-left")
    map.addControl(new ml.AttributionControl({ compact: false, customAttribution: "Trail and peak overlays: HikeLog" }), "bottom-right")
    map.on("style.load", () => installLayers(map, dataRef.current, live.current.basemap, live.current.layers))
    if (bounds && !p.focusHike && !p.networkSlug) map.fitBounds(bounds, { padding: 60, maxZoom: 10, duration: 0 })

    const ro = new ResizeObserver(() => map.resize())
    ro.observe(el)

    const nav = (href: string) => router.push(href)
    const hit = (pt: { x: number; y: number }, layerIds: string[]) => {
      const ids = layerIds.filter((id) => map.getLayer(id))
      if (!ids.length) return []
      return map.queryRenderedFeatures([[pt.x - 7, pt.y - 7], [pt.x + 7, pt.y + 7]], { layers: ids })
    }
    map.on("click", (e) => {
      const { props: pr, section: sec, layers: ly } = live.current
      popupRef.current?.remove()
      const peak = ly.peaks ? hit(e.point, ["peaks"])[0] : undefined
      if (peak) {
        const f = peak.properties
        const content = popupEl(
          String(f.name),
          [[f.state, f.ele ? `${Number(f.ele).toLocaleString("en-US")} ft` : null].filter(Boolean).join(" · "), f.done ? `Done${f.date ? ` ${f.date}` : ""}` : "Not done yet"].filter(Boolean),
          { href: `/peaks/${f.slug}`, label: "Open peak page" },
          nav
        )
        popupRef.current = new ml.Popup({ maxWidth: "260px", offset: 10 })
          .setLngLat((peak.geometry as unknown as { coordinates: [number, number] }).coordinates)
          .setDOMContent(content)
          .addTo(map)
        return
      }
      if (sec) {
        const s = hit(e.point, ["sel-line"])[0]
        if (s) {
          const idx = Number(s.properties.idx)
          setSection((cur) => (!cur || cur.a == null || cur.b != null ? { a: idx, b: null } : { a: cur.a, b: idx }))
          return
        }
      }
      const tr = ly.tracks ? hit(e.point, ["tracks"])[0] : undefined
      if (tr) {
        const f = tr.properties
        popupRef.current = new ml.Popup({ maxWidth: "260px" })
          .setLngLat(e.lngLat)
          .setDOMContent(popupEl(String(f.title || "GPS track"), [`${f.date} · ${Number(f.lengthMi).toFixed(1)} mi`, String(f.people)], { href: `/hikes/${f.hikeId}`, label: "Open hike" }, nav))
          .addTo(map)
        return
      }
      const net = ly.network ? hit(e.point, ["net-covered", "net-uncovered"])[0] : undefined
      if (net) void selectTrail(Number(net.properties.trailId), pr.personId)
    })
    map.on("mousemove", (e) => {
      const ids = ["peaks", "tracks", "net-covered", "net-uncovered", "sel-line"].filter((id) => map.getLayer(id))
      const { x, y } = e.point
      map.getCanvas().style.cursor = ids.length && map.queryRenderedFeatures([[x - 5, y - 5], [x + 5, y + 5]], { layers: ids }).length ? "pointer" : ""
    })
    return () => {
      ro.disconnect()
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
      // a re-created map (React strict mode, hot reload) must fly/fit/style again
      flownTo.current = null
      focused.current = false
      lastStyle.current = ""
    }
  }, [router, selectTrail])

  // ---------- basemap / theme ----------
  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const key = `${basemap}|${basemap === "streets" ? (props.styleUrl || (dark ? "dark" : "light")) : "topo"}`
    if (!lastStyle.current) {
      lastStyle.current = key
      // first run: the map was created with the matching light/dark style; only swap if they disagree
      if (basemap === "streets" && !props.styleUrl && dark) map.setStyle(styleSpec(basemap, props.styleUrl, dark))
      return
    }
    if (lastStyle.current === key) return
    lastStyle.current = key
    map.setStyle(styleSpec(basemap, props.styleUrl, dark))
  }, [basemap, dark, props.styleUrl])

  // ---------- data: peaks ----------
  React.useEffect(() => {
    putData(mapRef.current, dataRef.current, "peaks", {
      type: "FeatureCollection",
      features: props.peaks.map((k) => ({
        type: "Feature",
        properties: { slug: k.slug, name: k.name, ele: k.elevationFt, state: k.state, done: k.done ? 1 : 0, date: k.date },
        geometry: { type: "Point", coordinates: [k.lon, k.lat] },
      })),
    })
  }, [props.peaks])

  // ---------- data: GPS tracks ----------
  React.useEffect(() => {
    let alive = true
    api<{ tracks: TrackInfo[] }>("/api/v1/tracks")
      .then((r) => alive && setTracks(r.tracks))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [refreshKey])

  React.useEffect(() => {
    const feats: Feature[] = []
    for (const t of tracks) {
      const mine = t.people.some((p) => p.id === props.personId)
      if (!everyone && !mine) continue
      const owner = mine ? props.personId : t.people[0]?.id
      feats.push({
        type: "Feature",
        properties: { hikeId: t.hikeId, title: t.title, date: t.date, lengthMi: t.lengthMi, people: t.people.map((p) => p.name).join(", "), color: personColor.get(owner ?? -1) ?? "#2563eb" },
        geometry: t.geojson,
      })
    }
    putData(mapRef.current, dataRef.current, "tracks", { type: "FeatureCollection", features: feats })
  }, [tracks, everyone, props.personId, personColor])

  // focus one hike (from the hike page)
  React.useEffect(() => {
    const map = mapRef.current
    if (!map || !props.focusHike || focused.current) return
    const t = tracks.find((x) => x.hikeId === props.focusHike)
    if (!t) return
    focused.current = true
    const b = boundsOf(t.geojson)
    if (b) map.fitBounds(b, { padding: { top: 60, left: 60, right: 60, bottom: isDesktop ? 60 : 180 }, maxZoom: 15, duration: 0 })
  }, [tracks, props.focusHike, isDesktop])

  // ---------- data: trail network ----------
  const netSlug = props.networkSlug
  const netDownloaded = !!props.networks.find((n) => n.slug === netSlug)?.downloaded
  const netKey = `${netSlug}|${props.personId}|${refreshKey}`
  React.useEffect(() => {
    if (!netSlug || !netDownloaded) {
      putData(mapRef.current, dataRef.current, "net", emptyFC)
      return
    }
    const ac = new AbortController()
    fetch(`/api/v1/networks/${netSlug}/geojson?person=${props.personId}`, { signal: ac.signal, credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<FC>) : Promise.reject(new Error(String(r.status)))))
      .then((fc) => {
        putData(mapRef.current, dataRef.current, "net", fc)
        setNetResult({ key: netKey, ok: true, count: fc.features.length })
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setNetResult({ key: netKey, ok: false, count: 0 })
      })
    return () => ac.abort()
  }, [netSlug, netDownloaded, props.personId, netKey])
  const netState: "idle" | "loading" | "error" = !netSlug || !netDownloaded ? "idle" : netResult?.key !== netKey ? "loading" : netResult.ok ? "idle" : "error"

  // fly to a network when it is chosen
  React.useEffect(() => {
    const map = mapRef.current
    const n = props.networks.find((x) => x.slug === netSlug)
    if (!map || !n?.bbox || flownTo.current === netSlug || (props.focusHike && !netSlug)) return
    flownTo.current = netSlug
    map.fitBounds([[n.bbox[0], n.bbox[1]], [n.bbox[2], n.bbox[3]]], { padding: { top: 50, left: 50, right: 50, bottom: isDesktop ? 50 : 170 }, maxZoom: 12, duration: 600 })
  }, [netSlug, props.networks, props.focusHike, isDesktop])

  // ---------- selected trail + section picking ----------
  const trailId = trail?.trail.id
  React.useEffect(() => {
    if (!trailId) return
    let alive = true
    api<TrailInfo>(`/api/v1/trails/${trailId}/segments?person=${props.personId}`)
      .then((t) => alive && setTrail(t))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [trailId, props.personId, refreshKey])

  React.useEffect(() => {
    if (!trail) {
      putData(mapRef.current, dataRef.current, "sel", emptyFC)
      return
    }
    const lo = section && section.a != null ? Math.min(section.a, section.b ?? section.a) : -1
    const hi = section && section.a != null ? Math.max(section.a, section.b ?? section.a) : -2
    putData(mapRef.current, dataRef.current, "sel", {
      type: "FeatureCollection",
      features: trail.segments.map((s) => ({
        type: "Feature",
        properties: { idx: s.idx, covered: s.coveredBy.some((c) => c.person === props.personId) ? 1 : 0, range: s.idx >= lo && s.idx <= hi ? 1 : 0 },
        geometry: { type: "LineString", coordinates: s.coords },
      })),
    })
  }, [trail, section, props.personId])

  React.useEffect(() => {
    if (mapRef.current) applyVisibility(mapRef.current, layers)
  }, [layers])

  // re-colour after a theme switch that did not change the basemap
  React.useEffect(() => {
    const t = setTimeout(() => {
      const map = mapRef.current
      if (!map || !map.getStyle()) return
      for (const id of Object.values(LAYER_GROUPS).flat().concat(["sel-halo", "sel-line"])) if (map.getLayer(id)) map.removeLayer(id)
      installLayers(map, dataRef.current, live.current.basemap, live.current.layers)
    }, 80)
    return () => clearTimeout(t)
  }, [resolvedTheme])

  // keep the attribution clear of the phone sheet
  React.useEffect(() => {
    const h = wrapRef.current?.clientHeight ?? 700
    const px = sheet === "peek" ? 132 : sheet === "half" ? h * 0.5 : 0
    wrapRef.current?.style.setProperty("--map-attrib-offset", isDesktop ? "0px" : `${Math.round(px)}px`)
  }, [sheet, isDesktop])

  const refresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1)
    router.refresh()
  }, [router])

  const flyToBbox = (b: [number, number, number, number] | null) => {
    const map = mapRef.current
    if (!map || !b) return
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 60, left: 60, right: 60, bottom: isDesktop ? 60 : 200 }, maxZoom: 15, duration: 500 })
  }

  const panelProps = {
    ...props,
    layers,
    setLayers,
    basemap,
    setBasemap,
    everyone,
    setEveryone,
    trail,
    clearTrail: () => {
      setTrail(null)
      setSection(null)
    },
    section,
    setSection,
    refresh,
    flyToBbox,
    netState,
    featureCount: netResult?.count ?? 0,
    trackCount: tracks.length,
  }

  return (
    <div ref={wrapRef} className="relative flex h-full min-h-0 w-full">
      {isDesktop && (
        <aside aria-label="Map controls" className="flex w-[22rem] shrink-0 flex-col overflow-y-auto border-r bg-background p-4 xl:w-96">
          <MapPanel {...panelProps} />
        </aside>
      )}
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-0">
          <div ref={elRef} className="size-full" role="region" aria-label="Map" />
        </div>
        {!isDesktop && (
          <BottomSheet state={sheet} onStateChange={setSheet} peek={<PanelSummary {...panelProps} />}>
            <MapPanel {...panelProps} />
          </BottomSheet>
        )}
      </div>
    </div>
  )
}
