"use client"

import * as React from "react"
import { Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"

export function PasswordForm({ userId }: { userId: number }) {
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const password = String(f.get("password") ?? "")
    if (password !== String(f.get("confirm") ?? "")) return setError("Passwords don't match.")
    setPending(true)
    setError(null)
    try {
      await api(`/api/v1/users/${userId}`, { method: "PATCH", body: { password } })
      toast.success("Password changed. You'll be asked to sign in again on other devices.")
      form.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't change the password.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="max-w-sm" noValidate>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-11 md:h-8" />
          <FieldDescription>At least 8 characters.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required className="h-11 md:h-8" />
        </Field>
        {error && <FieldError role="alert">{error}</FieldError>}
        <Button type="submit" disabled={pending} className="h-11 w-fit md:h-8">
          {pending && <Loader2Icon className="animate-spin" />} Change password
        </Button>
      </FieldGroup>
    </form>
  )
}
