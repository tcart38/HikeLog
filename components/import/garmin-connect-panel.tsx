"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"
import { StatusCard } from "./status-card"

type Status = { state: "none" | "connected" | "pending"; meta?: { email?: string }; lastSyncAt?: string | null; lastError?: string | null }

export function GarminConnectPanel({ status }: { status: Status }) {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const needsCode = status.state === "pending"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api<{ result: string }>("/api/v1/import/garmin-connect/connection", {
        method: "PUT",
        body: needsCode ? { mfaCode: code } : { email: email.trim(), password },
      })
      setPassword("")
      setCode("")
      if (r.result === "connected") toast.success("Garmin Connect signed in")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {status.state === "connected" && (
        <StatusCard
          title="Signed in to Garmin Connect"
          detail={status.meta?.email}
          lastSyncAt={status.lastSyncAt}
          lastError={status.lastError}
          syncPath="/api/v1/import/garmin-connect/sync"
          disconnectPath="/api/v1/import/garmin-connect/connection"
          label="Garmin Connect"
        />
      )}
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-3">
        {needsCode ? (
          <Field>
            <FieldLabel htmlFor="gc-code">Garmin verification code</FieldLabel>
            <Input id="gc-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="h-11 md:h-8" placeholder="6-digit code" />
            <FieldDescription>Garmin emailed or texted a code to {status.meta?.email ?? "you"}. It expires quickly.</FieldDescription>
          </Field>
        ) : (
          <>
            <Field>
              <FieldLabel htmlFor="gc-email">{status.state === "connected" ? "Sign in again (Garmin email)" : "Garmin Connect email"}</FieldLabel>
              <Input id="gc-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 md:h-8" />
            </Field>
            <Field>
              <FieldLabel htmlFor="gc-pass">Garmin Connect password</FieldLabel>
              <Input id="gc-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 md:h-8" />
              <FieldDescription>Sent to Garmin once, never stored here. Only the session tokens are kept, encrypted.</FieldDescription>
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-fit md:h-8" disabled={busy || (needsCode ? !code.trim() : !email.trim() || !password)}>
          {busy && <Loader2Icon className="animate-spin" />} {needsCode ? "Verify" : status.state === "connected" ? "Sign in again" : "Sign in"}
        </Button>
        {needsCode && (
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-fit md:h-8"
            onClick={async () => {
              await api("/api/v1/import/garmin-connect/connection", { method: "DELETE" }).catch(() => {})
              router.refresh()
            }}
          >
            Start over
          </Button>
        )}
      </form>
    </div>
  )
}
