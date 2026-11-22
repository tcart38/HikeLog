"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/client/api"

type U = { id: number; username: string; is_admin: number; personName: string | null }

export function UsersPanel({ users, currentId }: { users: U[]; currentId: number }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    try {
      await api("/api/v1/users", {
        body: {
          username: String(f.get("username")).trim(),
          password: String(f.get("password")),
          displayName: String(f.get("displayName") ?? "").trim() || undefined,
          isAdmin: f.get("isAdmin") === "on",
        },
      })
      toast.success("Account created")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the account.")
    } finally {
      setPending(false)
    }
  }

  async function setAdmin(u: U, isAdmin: boolean) {
    try {
      await api(`/api/v1/users/${u.id}`, { method: "PATCH", body: { isAdmin } })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the account.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
        {users.map((u) => (
          <li key={u.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{u.personName ?? u.username}</span>
                {u.id === currentId && <Badge variant="secondary">You</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">@{u.username}</div>
            </div>
            <label className="flex min-h-10 shrink-0 items-center gap-2 text-sm">
              Admin
              <Switch checked={!!u.is_admin} onCheckedChange={(c) => setAdmin(u, c)} />
            </label>
          </li>
        ))}
      </ul>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" className="h-11 w-fit md:h-8" />}>
          <PlusIcon /> Add account
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={create} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Add an account</DialogTitle>
              <DialogDescription>Give your partner or a friend their own login. They&apos;ll also appear as a person on hikes.</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="u-display">Name</FieldLabel>
                <Input id="u-display" name="displayName" placeholder="Sam" className="h-11 md:h-8" />
                <FieldDescription>If a person with this name already exists, the account links to them.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="u-username">Username</FieldLabel>
                <Input id="u-username" name="username" required minLength={3} autoCapitalize="none" className="h-11 md:h-8" />
              </Field>
              <Field>
                <FieldLabel htmlFor="u-password">Password</FieldLabel>
                <Input id="u-password" name="password" type="password" required minLength={8} autoComplete="new-password" className="h-11 md:h-8" />
              </Field>
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <Switch name="isAdmin" /> Admin
              </label>
            </FieldGroup>
            {error && <FieldError role="alert">{error}</FieldError>}
            <DialogFooter>
              <Button type="submit" disabled={pending} className="h-11 md:h-8">
                {pending && <Loader2Icon className="animate-spin" />} Create account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
