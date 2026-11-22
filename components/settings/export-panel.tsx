"use client"

import * as React from "react"
import { CloudDownloadIcon, DatabaseIcon, DownloadIcon, FileJsonIcon, Loader2Icon, TableIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"

const FORMATS = [
  { format: "json", icon: FileJsonIcon, title: "Everything (JSON)", text: "People, hikes with peaks, participants, weather, photo and video list, GPS tracks and custom lists." },
  { format: "hikes.csv", icon: TableIcon, title: "Hikes (CSV)", text: "One row per hike. Opens in Excel, Numbers or Sheets." },
  { format: "ascents.csv", icon: TableIcon, title: "Ascents (CSV)", text: "One row per person per peak per hike, ready for a pivot table." },
]

export function ExportPanel({ isAdmin, mediaCount }: { isAdmin: boolean; mediaCount: number }) {
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid gap-3 sm:grid-cols-2">
        {FORMATS.map((f) => (
          <li key={f.format} className="flex flex-col justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="flex items-start gap-3">
              <f.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium">{f.title}</div>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            </div>
            <Button variant="outline" className="h-10 w-fit md:h-8" nativeButton={false} render={<a href={`/api/v1/export?format=${f.format}`} download />}>
              <DownloadIcon /> Download
            </Button>
          </li>
        ))}
        {isAdmin && (
          <li className="flex flex-col justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
            <div className="flex items-start gap-3">
              <DatabaseIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <div className="font-medium">Database backup (admin)</div>
                <p className="text-sm text-muted-foreground">A consistent copy of the SQLite file, including accounts. Keep it private.</p>
              </div>
            </div>
            <Button variant="outline" className="h-10 w-fit md:h-8" nativeButton={false} render={<a href="/api/v1/export?format=database" download />}>
              <DownloadIcon /> Download
            </Button>
          </li>
        )}
      </ul>
      <p className="max-w-2xl text-sm text-muted-foreground">
        {mediaCount > 0 ? `Your ${mediaCount} photo and video ${mediaCount === 1 ? "file is" : "files are"} ` : "Photos and videos will be "}
        stored in the <code className="rounded bg-muted px-1 py-0.5 text-xs">media/</code> folder of the Docker data volume and are not inside these downloads. To back up everything, copy the whole volume
        (see the README), or the database file plus that folder.
      </p>
    </div>
  )
}

/** Fill in weather for every hike that has a peak with coordinates or a GPS track, 20 at a time. */
export function WeatherBackfill({ missing }: { missing: number }) {
  const [busy, setBusy] = React.useState(false)
  const [left, setLeft] = React.useState(missing)
  async function go() {
    setBusy(true)
    let total = 0
    try {
      for (;;) {
        const r = await api<{ imported: number; remaining: number; failed: { error: string }[] }>("/api/v1/weather/backfill", { method: "POST" })
        total += r.imported
        setLeft(r.remaining)
        if (r.failed.length && !r.imported) throw new Error(r.failed[0].error)
        if (!r.imported || !r.remaining) break
      }
      toast.success(total ? `Imported weather for ${total} ${total === 1 ? "hike" : "hikes"}` : "Nothing to import")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import weather")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant="outline" className="h-10 md:h-8" disabled={busy || left === 0} onClick={go}>
        {busy ? <Loader2Icon className="animate-spin" /> : <CloudDownloadIcon />}
        {left === 0 ? "All hikes have weather" : `Import weather for ${left} ${left === 1 ? "hike" : "hikes"}`}
      </Button>
    </div>
  )
}
