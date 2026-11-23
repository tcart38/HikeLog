"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"

export function AuthForm({ mode }: { mode: "login" | "setup" | "signup" }) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const setup = mode !== "login" // setup and signup share the create-account fields

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const username = String(f.get("username") ?? "").trim()
    const password = String(f.get("password") ?? "")
    const displayName = String(f.get("displayName") ?? "").trim()
    if (setup && password !== String(f.get("confirm") ?? "")) {
      setError("Passwords don't match.")
      return
    }
    setPending(true)
    setError(null)
    try {
      await api(setup ? "/api/auth/signup" : "/api/auth/login", {
        body: setup ? { username, password, displayName: displayName || undefined } : { username, password },
      })
      router.replace("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full" noValidate>
      <FieldGroup>
        {setup && (
          <Field>
            <FieldLabel htmlFor="displayName">Your name</FieldLabel>
            <Input id="displayName" name="displayName" autoComplete="name" placeholder="Alex" className="h-11 md:h-9" />
            <FieldDescription>Shown on hikes you take part in. This becomes your person in the app.</FieldDescription>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="username">Username</FieldLabel>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            autoFocus
            className="h-11 md:h-9"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={setup ? "new-password" : "current-password"}
            required
            minLength={setup ? 8 : undefined}
            className="h-11 md:h-9"
          />
          {setup && <FieldDescription>At least 8 characters.</FieldDescription>}
        </Field>
        {setup && (
          <Field>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11 md:h-9" />
          </Field>
        )}
        {error && <FieldError role="alert">{error}</FieldError>}
        <Button type="submit" size="lg" className="h-11 w-full md:h-9" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {mode === "setup" ? "Create admin account" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  )
}
