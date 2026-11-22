"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, RefreshCwIcon, UnplugIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"
import { fmtDate } from "@/lib/format"

/** Connected-state card shared by the Garmin Connect and Strava panels: Sync now + Disconnect. */
export function StatusCard({
  title,
  detail,
  lastSyncAt,
  lastError,
  syncPath,
  disconnectPath,
  label,
}: {
  title: string
  detail?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
  syncPath: string
  disconnectPath: string
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState<"sync" | "disconnect" | null>(null)

  async function sync() {
    setBusy("sync")
    try {
      const r = await api<{ added: number; more?: boolean }>(syncPath, { method: "POST", body: {} })
      toast.success(
        (r.added ? `${r.added} new ${r.added === 1 ? "activity" : "activities"} to review` : `Nothing new from ${label}`) +
          (r.more ? ". There are more: press Sync now again." : "")
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.")
    } finally {
      setBusy(null)
      router.refresh()
    }
  }

  async function disconnect() {
    setBusy("disconnect")
    try {
      await api(disconnectPath, { method: "DELETE" })
      toast.success(`${label} disconnected`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2Icon className="size-4 text-primary" /> {title}
      </div>
      <p className="text-sm text-muted-foreground tnum">
        {detail ? `${detail} · ` : ""}
        {lastSyncAt ? `Last synced ${fmtDate(lastSyncAt.slice(0, 10))}` : "Not synced yet"}
      </p>
      {lastError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Last sync failed</AlertTitle>
          <AlertDescription>{lastError}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 md:h-8" onClick={sync} disabled={busy !== null}>
          {busy === "sync" ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Sync now
        </Button>
        <Button variant="outline" className="h-11 md:h-8" onClick={disconnect} disabled={busy !== null}>
          <UnplugIcon /> Disconnect
        </Button>
      </div>
    </div>
  )
}
