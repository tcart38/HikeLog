"use client"

import dynamic from "next/dynamic"

import type { MapExplorerProps } from "@/components/map/map-explorer"
import { Skeleton } from "@/components/ui/skeleton"

// MapLibre needs WebGL and `window`: load it in the browser only.
const MapExplorer = dynamic(() => import("@/components/map/map-explorer"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" aria-label="Loading map" />,
})

export function MapLoader(props: MapExplorerProps) {
  return <MapExplorer {...props} />
}
