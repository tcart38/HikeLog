"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, MapPinPlusIcon, Trash2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"

/** "Add GPS track": upload a .gpx or GeoJSON file for a hike (or replace / remove the one it has). */
export function HikeTrackActions({ hikeId, hasTrack }: { hikeId: number; hasTrack: boolean }) {
  const router = useRouter()
  const input = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const form = new FormData()
      form.set("file", file)
      await api(`/api/v1/hikes/${hikeId}/track`, { form })
      toast.success("GPS track saved. Trail coverage is updated.")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that file")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await api(`/api/v1/hikes/${hikeId}/track`, { method: "DELETE" })
      toast.success("GPS track removed")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove the track")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        type="file"
        accept=".gpx,.geojson,.json,application/gpx+xml,application/geo+json,application/json,text/xml,application/xml"
        className="sr-only"
        aria-label="GPS track file"
        tabIndex={-1}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <Button variant="outline" className="h-10 md:h-8" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2Icon className="animate-spin" /> : hasTrack ? <UploadIcon /> : <MapPinPlusIcon />}
        {hasTrack ? "Replace track" : "Add GPS track"}
      </Button>
      {hasTrack && (
        <Button variant="ghost" className="h-10 md:h-8" disabled={busy} onClick={remove}>
          <Trash2Icon /> Remove
        </Button>
      )}
    </div>
  )
}
