"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertCircleIcon, CheckCircle2Icon, Loader2Icon, RefreshCwIcon, UnplugIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"
import { fmtDate } from "@/lib/format"
import type { GarminStatus } from "./types"

const PORTAL = "https://connect.garmin.com/app/settings/personalApiToken"

export function ConnectionPanel({ status }: { status: GarminStatus }) {
  const router = useRouter()
  const [key, setKey] = React.useState("")
  const [busy, setBusy] = React.useState<"connect" | "sync" | "disconnect" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function connect(e: React.FormEvent) {
    e.preventDefault()
    setBusy("connect")
    setError(null)
    try {
      await api("/api/v1/garmin/connection", { method: "PUT", body: { apiKey: key.trim() } })
      setKey("")
      toast.success("Garmin connected")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't connect.")
    } finally {
      setBusy(null)
    }
  }

  async function sync() {
    setBusy("sync")
    try {
      const r = await api<{ added: number }>("/api/v1/garmin/sync", { method: "POST", body: {} })
      toast.success(r.added ? `${r.added} new ${r.added === 1 ? "activity" : "activities"} to review` : "Nothing new from Garmin")
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
      await api("/api/v1/garmin/connection", { method: "DELETE" })
      toast.success("Garmin disconnected")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't disconnect.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status.connected ? (
        <div className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2Icon className="size-4 text-primary" /> Connected to Garmin
          </div>
          <p className="text-sm text-muted-foreground tnum">
            {status.lastSyncAt ? `Last synced ${fmtDate(status.lastSyncAt.slice(0, 10))}` : "Not synced yet"}
            {status.keyExpiresAt ? ` · key expires ${fmtDate(status.keyExpiresAt)}` : ""}
          </p>
          {status.lastError && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Last sync failed</AlertTitle>
              <AlertDescription>{status.lastError} If your key expired, create a new one and paste it below.</AlertDescription>
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
      ) : null}

      <form onSubmit={connect} className="flex max-w-xl flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="garmin-key">{status.connected ? "Replace your API key" : "Personal API key"}</FieldLabel>
          <Input
            id="garmin-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste the key from Garmin"
            className="h-11 md:h-8"
          />
          <FieldDescription>Stored encrypted on this server and never shown again.</FieldDescription>
        </Field>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="h-11 w-fit md:h-8" disabled={!key.trim() || busy !== null}>
          {busy === "connect" && <Loader2Icon className="animate-spin" />} {status.connected ? "Replace key" : "Connect Garmin"}
        </Button>
      </form>

      <details className="max-w-2xl text-sm">
        <summary className="min-h-9 cursor-pointer py-2 font-medium">How to get a Garmin personal API key</summary>
        <ol className="flex list-decimal flex-col gap-1.5 py-2 pl-5 text-muted-foreground">
          <li>
            Sign in to Garmin Connect on the web and open the{" "}
            <a href={PORTAL} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
              Personal API key page
            </a>
            .
          </li>
          <li>Choose Create Key, accept the terms, pick an expiry (30, 90, 180 days or a year), then Create.</li>
          <li>Copy the key right away. Garmin shows it only once.</li>
          <li>Paste it above. Each person connects their own Garmin account from their own HikeLog login.</li>
          <li>Garmin emails you about a week before the key expires. Paste a new one here when that happens.</li>
        </ol>
      </details>
    </div>
  )
}
