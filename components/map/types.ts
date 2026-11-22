import type { Geometry } from "@/components/map/map-utils"

export type MapPerson = { id: number; name: string; color: string }

export type MapPeak = {
  id: number
  slug: string
  name: string
  elevationFt: number | null
  state: string | null
  lat: number
  lon: number
  done: boolean
  date: string | null
}

export type NetworkCoverage = { personId: number; coveredMi: number; totalMi: number; percent: number; trailsDone: number }

export type MapNetwork = {
  slug: string
  name: string
  groupSlug: string | null
  groupName: string | null
  downloaded: boolean
  fetchedAt: string | null
  totalMi: number
  trailCount: number
  bbox: [number, number, number, number] | null
  coverage: NetworkCoverage[]
}

export type HikeOption = { id: number; label: string; date: string }

export type SegmentInfo = { idx: number; lengthM: number; coords: [number, number][]; coveredBy: { person: number; source: string }[] }
export type TrailInfo = {
  trail: { id: number; name: string; networkId: number; lengthMi: number }
  segments: SegmentInfo[]
  bbox: [number, number, number, number] | null
}

export type TrackInfo = {
  hikeId: number
  date: string
  title: string | null
  lengthMi: number
  bbox: [number, number, number, number] | null
  people: { id: number; name: string }[]
  geojson: Geometry
}
