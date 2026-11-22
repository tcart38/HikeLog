"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CloudDownloadIcon, Loader2Icon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"

/** Import (or refresh / remove) the daily weather for a hike from Open-Meteo. */
export function HikeWeatherActions({ hikeId, hasWeather }: { hikeId: number; hasWeather: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  async function run(method: "POST" | "DELETE") {
    setBusy(true)
    try {
      await api(`/api/v1/hikes/${hikeId}/weather`, { method })
      toast.success(method === "POST" ? "Weather imported" : "Weather removed")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import weather")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" className="h-10 md:h-8" disabled={busy} onClick={() => run("POST")}>
        {busy ? <Loader2Icon className="animate-spin" /> : hasWeather ? <RefreshCwIcon /> : <CloudDownloadIcon />}
        {hasWeather ? "Refresh weather" : "Import weather"}
      </Button>
      {hasWeather && (
        <Button variant="ghost" className="h-10 md:h-8" disabled={busy} onClick={() => run("DELETE")}>
          <Trash2Icon /> Remove
        </Button>
      )}
    </div>
  )
}
