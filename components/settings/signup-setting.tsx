"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/client/api"

export function SignupSetting({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [on, setOn] = React.useState(enabled)
  const [pending, setPending] = React.useState(false)

  async function change(next: boolean) {
    setOn(next)
    setPending(true)
    try {
      await api("/api/v1/settings/signup", { method: "PUT", body: { enabled: next } })
      toast.success(next ? "Public sign-up turned on" : "Public sign-up turned off")
      router.refresh()
    } catch (err) {
      setOn(!next)
      toast.error(err instanceof Error ? err.message : "Couldn't update the setting.")
    } finally {
      setPending(false)
    }
  }

  return (
    <label className="flex min-h-14 items-center justify-between gap-4 rounded-xl px-4 py-2 ring-1 ring-foreground/10">
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">Allow public sign-up</span>
        <span className="text-xs text-muted-foreground">
          Shows a &ldquo;Create account&rdquo; link on the sign-in page. New accounts are regular users, not admins. Off by default.
        </span>
      </span>
      <Switch checked={on} disabled={pending} onCheckedChange={change} />
    </label>
  )
}
