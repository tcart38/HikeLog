"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ExternalLinkIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"
import { StatusCard } from "./status-card"

export type StravaStatus = {
  state: "none" | "connected" | "pending"
  meta?: { athlete?: string | null }
  lastSyncAt?: string | null
  lastError?: string | null
  settingsUrl: string
  callbackDomain: string
  authorizeUrl: string | null
  authorizeUrlLocalhost: string | null
}

export function StravaPanel({ status, notice }: { status: StravaStatus; notice?: string | null }) {
  const router = useRouter()
  const [clientId, setClientId] = React.useState("")
  const [secret, setSecret] = React.useState("")
  const [pasted, setPasted] = React.useState("")
  const [busy, setBusy] = React.useState<"save" | "code" | null>(null)
  const [error, setError] = React.useState<string | null>(notice && notice !== "ok" ? notice : null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy("save")
    setError(null)
    try {
      await api("/api/v1/import/strava/connection", { method: "PUT", body: { clientId, clientSecret: secret } })
      setSecret("")
      toast.success("Strava app saved. Now authorise it.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.")
    } finally {
      setBusy(null)
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault()
    setBusy("code")
    setError(null)
    try {
      await api("/api/v1/import/strava/authorize", { body: { code: pasted } })
      setPasted("")
      toast.success("Strava connected")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't authorise.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {status.state === "connected" && (
        <StatusCard
          title="Connected to Strava"
          detail={status.meta?.athlete}
          lastSyncAt={status.lastSyncAt}
          lastError={status.lastError}
          syncPath="/api/v1/import/strava/sync"
          disconnectPath="/api/v1/import/strava/connection"
          label="Strava"
        />
      )}
      {notice === "ok" && <p className="text-sm text-primary">Strava authorised.</p>}

      <details className="max-w-2xl text-sm" open={status.state === "none"}>
        <summary className="min-h-9 cursor-pointer py-2 font-medium">1. Create your free Strava API app</summary>
        <ol className="flex list-decimal flex-col gap-1.5 py-2 pl-5 text-muted-foreground">
          <li>
            Open{" "}
            <a href={status.settingsUrl} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
              strava.com/settings/api
            </a>{" "}
            and create an app (name, website and description can be anything).
          </li>
          <li>
            Set <strong className="text-foreground">Authorization Callback Domain</strong> to <code className="text-foreground">{status.callbackDomain}</code> (the address you use for HikeLog), or{" "}
            <code className="text-foreground">localhost</code> to use the paste-the-address route below.
          </li>
          <li>Copy the Client ID and Client Secret into the form.</li>
        </ol>
      </details>

      <form onSubmit={save} className="flex max-w-xl flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="st-id">Client ID</FieldLabel>
          <Input id="st-id" inputMode="numeric" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-11 md:h-8" placeholder="e.g. 123456" />
        </Field>
        <Field>
          <FieldLabel htmlFor="st-secret">Client Secret</FieldLabel>
          <Input id="st-secret" type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(e) => setSecret(e.target.value)} className="h-11 md:h-8" />
          <FieldDescription>Stored encrypted on this server and never shown again.</FieldDescription>
        </Field>
        <Button type="submit" variant={status.state === "none" ? "default" : "outline"} className="h-11 w-fit md:h-8" disabled={busy !== null || !clientId.trim() || !secret.trim()}>
          {busy === "save" && <Loader2Icon className="animate-spin" />} {status.state === "none" ? "Save app" : "Replace app credentials"}
        </Button>
      </form>

      {status.authorizeUrl && (
        <div className="flex max-w-xl flex-col gap-3 border-t pt-5">
          <h3 className="text-sm font-medium">2. Authorise HikeLog on Strava</h3>
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 md:h-8" render={<a href={status.authorizeUrl} />}>
              Authorise with Strava <ExternalLinkIcon />
            </Button>
          </div>
          <details className="text-sm">
            <summary className="min-h-9 cursor-pointer py-2 text-muted-foreground">Strava won&apos;t redirect back? Use the paste route</summary>
            <div className="flex flex-col gap-3 py-2">
              <p className="text-muted-foreground">
                Set the callback domain in your Strava app to <code className="text-foreground">localhost</code>, open the link below, approve, and copy the whole address of the page that
                fails to load. Paste it here.
              </p>
              {status.authorizeUrlLocalhost && (
                <a href={status.authorizeUrlLocalhost} className="w-fit text-foreground underline underline-offset-4">
                  Authorise (localhost route)
                </a>
              )}
              <form onSubmit={finish} className="flex flex-col gap-2">
                <Input value={pasted} onChange={(e) => setPasted(e.target.value)} className="h-11 md:h-8" placeholder="http://localhost/hikelog?state=…&code=…" aria-label="Address from Strava" />
                <Button type="submit" variant="outline" className="h-11 w-fit md:h-8" disabled={busy !== null || !pasted.trim()}>
                  {busy === "code" && <Loader2Icon className="animate-spin" />} Finish
                </Button>
              </form>
            </div>
          </details>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
