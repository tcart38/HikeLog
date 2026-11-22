"use client"

import dynamic from "next/dynamic"

import type { Geometry } from "@/components/map/map-utils"
import { Skeleton } from "@/components/ui/skeleton"

const HikeMap = dynamic(() => import("@/components/map/hike-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" aria-label="Loading map" />,
})

export function HikeMapLoader(props: { geojson: Geometry; styleUrl: string | null; color?: string }) {
  return <HikeMap {...props} />
}
