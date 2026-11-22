"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api } from "@/lib/client/api"
import { fmtDate } from "@/lib/format"

type Token = { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }

export function TokensPanel({ tokens }: { tokens: Token[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [created, setCreated] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await api<{ token: string }>("/api/v1/tokens", { body: { name: name.trim() } })
      setOpen(false)
      setName("")
      setCreated(res.token)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the token.")
    } finally {
      setPending(false)
    }
  }

  async function revoke(t: Token) {
    try {
      await api(`/api/v1/tokens/${t.id}`, { method: "DELETE" })
      toast.success(`Revoked ${t.name}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't revoke the token.")
    }
  }

  async function copy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy. Select the token and copy it manually.")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tokens yet. Create one to let a script or an AI agent log hikes through the API.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
          {tokens.map((t) => (
            <li key={t.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <div className="flex min-w-0 items-center gap-3">
                <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground tnum">
                    <span className="font-mono">{t.prefix}…</span> · created {fmtDate(t.created_at.slice(0, 10))} · {t.last_used_at ? `used ${fmtDate(t.last_used_at.slice(0, 10))}` : "never used"}
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="size-10 text-destructive md:size-8" onClick={() => revoke(t)} aria-label={`Revoke ${t.name}`}>
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button variant="outline" className="h-11 w-fit md:h-8" />}>
          <PlusIcon /> New token
        </DialogTrigger>
        <DialogContent>
          <form onSubmit={create} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New API token</DialogTitle>
              <DialogDescription>Name it after what will use it, like &ldquo;Claude agent&rdquo; or &ldquo;Phone shortcut&rdquo;.</DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="token-name">Name</FieldLabel>
              <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus className="h-11 md:h-8" />
            </Field>
            {error && <FieldError role="alert">{error}</FieldError>}
            <DialogFooter>
              <Button type="submit" disabled={pending || !name.trim()} className="h-11 md:h-8">
                {pending && <Loader2Icon className="animate-spin" />} Create token
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!created} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy your token now</DialogTitle>
            <DialogDescription>This is the only time it&apos;s shown. Store it somewhere safe. If you lose it, revoke it and make a new one.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={created ?? ""} onFocus={(e) => e.currentTarget.select()} aria-label="API token" className="h-11 font-mono text-xs md:h-9" />
            <Button type="button" variant="outline" className="h-11 md:h-9" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" className="h-11 md:h-8" onClick={() => setCreated(null)}>
              I&apos;ve saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
