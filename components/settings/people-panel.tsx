"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, MergeIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/client/api"

type P = { id: number; name: string; username: string | null; hikes: number }
type Action = { kind: "add" } | { kind: "rename"; p: P } | { kind: "merge"; p: P } | { kind: "delete"; p: P }

export function PeoplePanel({ people }: { people: P[] }) {
  const router = useRouter()
  const [action, setAction] = React.useState<Action | null>(null)
  const [text, setText] = React.useState("")
  const [target, setTarget] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function openAction(a: Action) {
    setAction(a)
    setError(null)
    setText(a.kind === "rename" ? a.p.name : "")
    setTarget("")
  }

  async function run(e: React.FormEvent) {
    e.preventDefault()
    if (!action) return
    setPending(true)
    setError(null)
    try {
      if (action.kind === "add") await api("/api/v1/people", { body: { name: text.trim() } })
      if (action.kind === "rename") await api(`/api/v1/people/${action.p.id}`, { method: "PATCH", body: { name: text.trim() } })
      if (action.kind === "merge") await api(`/api/v1/people/${action.p.id}/merge`, { body: { into: Number(target) } })
      if (action.kind === "delete") await api(`/api/v1/people/${action.p.id}${action.p.hikes ? "?force=1" : ""}`, { method: "DELETE" })
      toast.success(action.kind === "add" ? "Person added" : action.kind === "rename" ? "Renamed" : action.kind === "merge" ? "Merged" : "Deleted")
      setAction(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    } finally {
      setPending(false)
    }
  }

  const mergeOptions = action?.kind === "merge" ? people.filter((p) => p.id !== action.p.id).map((p) => ({ value: String(p.id), label: p.name })) : []
  const title =
    action?.kind === "add" ? "Add a person" : action?.kind === "rename" ? "Rename" : action?.kind === "merge" ? `Merge ${action.p.name}` : action?.kind === "delete" ? `Delete ${action.p.name}?` : ""

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
        {people.map((p) => (
          <li key={p.id} className="flex min-h-14 items-center justify-between gap-2 px-4 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{p.name}</span>
                {p.username && <Badge variant="secondary">Has login</Badge>}
              </div>
              <div className="text-xs text-muted-foreground tnum">
                {p.hikes} {p.hikes === 1 ? "hike" : "hikes"}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" className="size-10 md:size-8" aria-label={`Rename ${p.name}`} onClick={() => openAction({ kind: "rename", p })}>
                <PencilIcon />
              </Button>
              <Button variant="ghost" size="icon" className="size-10 md:size-8" aria-label={`Merge ${p.name} into someone else`} disabled={!!p.username || people.length < 2} onClick={() => openAction({ kind: "merge", p })}>
                <MergeIcon />
              </Button>
              <Button variant="ghost" size="icon" className="size-10 text-destructive md:size-8" aria-label={`Delete ${p.name}`} disabled={!!p.username} onClick={() => openAction({ kind: "delete", p })}>
                <Trash2Icon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="h-11 w-fit md:h-8" onClick={() => openAction({ kind: "add" })}>
        <PlusIcon /> Add person
      </Button>

      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <form onSubmit={run} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {action?.kind === "merge" && "Moves every hike to the person you choose, then removes this one. Use it when the same person was entered twice."}
                {action?.kind === "delete" && (action.p.hikes ? `They're on ${action.p.hikes} ${action.p.hikes === 1 ? "hike" : "hikes"}. Deleting removes them from those hikes; the hikes stay. Merge instead to keep their credit.` : "They aren't on any hikes.")}
                {action?.kind === "add" && "For someone who hikes with you but doesn't need a login."}
                {action?.kind === "rename" && "Hikes keep their history under the new name."}
              </DialogDescription>
            </DialogHeader>
            {(action?.kind === "add" || action?.kind === "rename") && (
              <Field>
                <FieldLabel htmlFor="person-name">Name</FieldLabel>
                <Input id="person-name" value={text} onChange={(e) => setText(e.target.value)} required autoFocus className="h-11 md:h-8" />
              </Field>
            )}
            {action?.kind === "merge" && (
              <Field>
                <FieldLabel htmlFor="merge-into">Merge into</FieldLabel>
                <Select items={mergeOptions} value={target} onValueChange={(v) => setTarget(String(v))}>
                  <SelectTrigger id="merge-into" className="h-11 w-full md:h-8">
                    <SelectValue placeholder="Choose a person" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {mergeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {error && <FieldError role="alert">{error}</FieldError>}
            <DialogFooter>
              <Button
                type="submit"
                variant={action?.kind === "delete" ? "destructive" : "default"}
                disabled={pending || (action?.kind === "merge" && !target) || ((action?.kind === "add" || action?.kind === "rename") && !text.trim())}
                className="h-11 md:h-8"
              >
                {pending && <Loader2Icon className="animate-spin" />}
                {action?.kind === "add" ? "Add" : action?.kind === "rename" ? "Save" : action?.kind === "merge" ? "Merge" : "Delete"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
