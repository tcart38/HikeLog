"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/client/api"
import { fmtDate, fmtFt } from "@/lib/format"
import type { PlannedHike } from "@/lib/planned"
import { cn } from "@/lib/utils"

const SEASON_ITEMS = [
  { value: "any", label: "Any season" },
  { value: "winter", label: "Winter" },
]

export type CandidatePeak = {
  id: number
  name: string
  elevationFt: number | null
}

/** Peaks of one plan. Peaks that are already done (for the view being looked at) are muted. */
export function PlanPeaks({
  plan,
  doneIds,
}: {
  plan: PlannedHike
  doneIds?: Set<number>
}) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={`Peaks in ${plan.name}`}>
      {plan.peaks.map((p) => {
        const done = doneIds?.has(p.id)
        return (
          <li key={p.id}>
            <Badge
              variant={done ? "outline" : "secondary"}
              className={cn(done && "text-muted-foreground line-through")}
            >
              {p.name}
              {p.elevationFt != null && (
                <span className="tnum text-muted-foreground">
                  {p.elevationFt.toLocaleString("en-US")}
                </span>
              )}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}

export function PlanDialog({
  open,
  onOpenChange,
  ...rest
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  personId: number
  personName: string
  /** Peaks that can be picked: still needed and not in another plan, plus this plan's own peaks. */
  candidates: CandidatePeak[]
  plan?: PlannedHike
  initialPeakIds?: number[]
  defaultSeason?: "winter" | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, so the form starts fresh each time. */}
        <PlanForm onClose={() => onOpenChange(false)} {...rest} />
      </DialogContent>
    </Dialog>
  )
}

function PlanForm({
  onClose,
  personId,
  personName,
  candidates,
  plan,
  initialPeakIds,
  defaultSeason,
}: {
  onClose: () => void
  personId: number
  personName: string
  candidates: CandidatePeak[]
  plan?: PlannedHike
  initialPeakIds?: number[]
  defaultSeason?: "winter" | null
}) {
  const router = useRouter()
  const [name, setName] = React.useState(plan?.name ?? "")
  const [date, setDate] = React.useState(plan?.targetDate ?? "")
  const [notes, setNotes] = React.useState(plan?.notes ?? "")
  const [sel, setSel] = React.useState<number[]>(
    plan ? plan.peaks.map((p) => p.id) : (initialPeakIds ?? [])
  )
  const [season, setSeason] = React.useState<"any" | "winter">(
    plan ? (plan.season ?? "any") : (defaultSeason ?? "any")
  )
  const [q, setQ] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const shown = candidates.filter(
    (c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase())
  )
  const toggle = (id: number) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim())
      return setError("Give the plan a name, e.g. “Franconia Ridge loop”.")
    if (!sel.length) return setError("Pick at least one peak.")
    setPending(true)
    try {
      const body = {
        personId,
        name: name.trim(),
        targetDate: date || null,
        notes: notes.trim() || null,
        season: season === "winter" ? "winter" : null,
        peakIds: sel,
      }
      if (plan)
        await api(`/api/v1/planned-hikes/${plan.id}`, { method: "PATCH", body })
      else await api("/api/v1/planned-hikes", { body })
      toast.success(plan ? "Plan updated" : "Hike planned")
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the plan.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{plan ? "Edit planned hike" : "Plan a hike"}</DialogTitle>
        <DialogDescription>
          Group the peaks you want to hike together for {personName}.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="plan-name">Name</FieldLabel>
          <Input
            id="plan-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Franconia Ridge loop"
            className="h-10 md:h-8"
            maxLength={200}
          />
        </Field>
        <Field>
          <FieldLabel>Peaks ({sel.length} selected)</FieldLabel>
          {candidates.length > 10 && (
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search peaks"
              aria-label="Search peaks"
              className="h-10 md:h-8"
            />
          )}
          <ul className="max-h-56 overflow-y-auto rounded-lg ring-1 ring-foreground/10">
            {shown.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-muted/50 md:min-h-9">
                  <Checkbox
                    checked={sel.includes(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <span className="tnum shrink-0 text-xs text-muted-foreground">
                    {fmtFt(c.elevationFt)}
                  </span>
                </label>
              </li>
            ))}
            {!shown.length && (
              <li className="p-3 text-center text-sm text-muted-foreground">
                {candidates.length
                  ? "No peak matches."
                  : "Every remaining peak is already planned."}
              </li>
            )}
          </ul>
        </Field>
        <Field>
          <FieldLabel htmlFor="plan-season">Season</FieldLabel>
          <Select
            items={SEASON_ITEMS}
            value={season}
            onValueChange={(v) => setSeason(v === "winter" ? "winter" : "any")}
          >
            <SelectTrigger
              id="plan-season"
              className="h-10 w-full sm:w-56 md:h-8"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {SEASON_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Winter plans count only toward the Winter view. Any-season plans
            count everywhere.
          </p>
        </Field>
        <Field>
          <FieldLabel htmlFor="plan-date">Target date (optional)</FieldLabel>
          <Input
            id="plan-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full sm:w-44 md:h-8"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="plan-notes">Notes (optional)</FieldLabel>
          <Textarea
            id="plan-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Route, trailhead, who's coming"
          />
        </Field>
        {error && <FieldError>{error}</FieldError>}
      </FieldGroup>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-10 md:h-8"
          onClick={onClose}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" className="h-10 md:h-8" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}{" "}
          {plan ? "Save plan" : "Plan hike"}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** One plan: name, date, peaks and actions. `onEdit` is omitted where editing isn't available. */
export function PlanItem({
  plan,
  doneIds,
  onEdit,
}: {
  plan: PlannedHike
  doneIds?: Set<number>
  onEdit?: (p: PlannedHike) => void
}) {
  const router = useRouter()
  const [confirm, setConfirm] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const isDone = !!plan.doneAt

  async function run(fn: () => Promise<unknown>, ok: string) {
    setPending(true)
    try {
      await fn()
      toast.success(ok)
      setConfirm(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 font-medium">
            {plan.name}
            {plan.season === "winter" && (
              <Badge variant="outline">Winter</Badge>
            )}
            {isDone && (
              <Badge className="bg-done text-done-foreground">Done</Badge>
            )}
          </span>
          <span className="tnum flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarIcon className="size-3" />{" "}
            {plan.targetDate
              ? fmtDate(plan.targetDate, { weekday: true })
              : "No date yet"}
            <span aria-hidden>·</span>
            {plan.peaks.length} {plan.peaks.length === 1 ? "peak" : "peaks"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {isDone ? (
            <>
              {plan.hikeId && (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/hikes/${plan.hikeId}`} />}
                >
                  View hike
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      api(`/api/v1/planned-hikes/${plan.id}`, {
                        method: "PATCH",
                        body: { done: false },
                      }),
                    "Plan reopened"
                  )
                }
              >
                <RotateCcwIcon /> Reopen
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/hikes/new?plan=${plan.id}`} />}
            >
              <CheckCircle2Icon /> Log it
            </Button>
          )}
          {onEdit && !isDone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(plan)}
              aria-label={`Edit ${plan.name}`}
            >
              <PencilIcon /> Edit
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirm(true)}
            aria-label={`Delete ${plan.name}`}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
      <PlanPeaks plan={plan} doneIds={doneIds} />
      {plan.notes && (
        <p className="text-sm text-muted-foreground">{plan.notes}</p>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              “{plan.name}” will be removed and its peaks go back to unplanned.
              Logged hikes aren&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    api(`/api/v1/planned-hikes/${plan.id}`, {
                      method: "DELETE",
                    }),
                  "Plan deleted"
                )
              }
            >
              {pending && <Loader2Icon className="animate-spin" />} Delete plan
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Open/closed state of the card is remembered per browser (shared by every list).
const OPEN_KEY = "hikelog:planned-open"
const subscribeOpen = (cb: () => void) => {
  window.addEventListener("storage", cb)
  window.addEventListener("hikelog:planned-open", cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener("hikelog:planned-open", cb)
  }
}
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0"
  } catch {
    return true
  }
}
function writeOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "1" : "0")
  } catch {}
  window.dispatchEvent(new Event("hikelog:planned-open"))
}

/** The list page section: summary, open plans, and the peaks that are still in no plan. */
export function PlannedHikesPanel({
  personId,
  personName,
  plans,
  doneIds,
  unplanned,
  candidates,
  leftCount,
  noun,
  defaultSeason,
}: {
  personId: number
  personName: string
  plans: PlannedHike[]
  /** Peaks already done in the current view, so plans can show them as finished. */
  doneIds: number[]
  unplanned: CandidatePeak[]
  /** Pickable peaks per plan being edited: needed and unplanned, built on the server. */
  candidates: CandidatePeak[]
  leftCount: number
  noun: string
  defaultSeason?: "winter" | null
}) {
  const open = React.useSyncExternalStore(subscribeOpen, readOpen, () => true)
  const [dialog, setDialog] = React.useState<{
    plan?: PlannedHike
    peakIds?: number[]
  } | null>(null)
  const done = React.useMemo(() => new Set(doneIds), [doneIds])
  const pickable = (plan?: PlannedHike) => {
    if (!plan) return candidates
    const own = plan.peaks.map((p) => ({
      id: p.id,
      name: p.name,
      elevationFt: p.elevationFt,
    }))
    const ids = new Set(candidates.map((c) => c.id))
    return [...own.filter((o) => !ids.has(o.id)), ...candidates].sort(
      (a, b) => (b.elevationFt ?? 0) - (a.elevationFt ?? 0)
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Planned hikes</CardTitle>
        <CardDescription className="tnum">
          {leftCount === 0
            ? `Nothing left ${noun} for ${personName}.`
            : plans.length
              ? `${leftCount} ${leftCount === 1 ? "peak" : "peaks"} left: ${leftCount - unplanned.length} in ${plans.length} planned ${plans.length === 1 ? "hike" : "hikes"}${unplanned.length ? `, ${unplanned.length} not planned yet` : ""}.`
              : `${leftCount} ${leftCount === 1 ? "peak" : "peaks"} left, none planned yet. Group them into hikes to see how many outings that is.`}
        </CardDescription>
        <CardAction className="flex items-center gap-1.5">
          {open && leftCount > 0 && (
            <Button
              size="sm"
              onClick={() => setDialog({})}
              disabled={!candidates.length}
            >
              <PlusIcon /> Plan a hike
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => writeOpen(!open)}
            aria-expanded={open}
            aria-label={
              open ? "Collapse planned hikes" : "Expand planned hikes"
            }
          >
            <ChevronDownIcon
              className={cn("transition-transform", !open && "-rotate-90")}
            />
          </Button>
        </CardAction>
      </CardHeader>
      {open && (
        <CardContent className="flex flex-col gap-4">
          {plans.length > 0 && (
            <div className="flex flex-col gap-2">
              {plans.map((p) => (
                <PlanItem
                  key={p.id}
                  plan={p}
                  doneIds={done}
                  onEdit={(pl) => setDialog({ plan: pl })}
                />
              ))}
            </div>
          )}
          {unplanned.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                Not planned yet ({unplanned.length})
              </h3>
              <ul className="flex flex-wrap gap-1.5">
                {unplanned.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setDialog({ peakIds: [p.id] })}
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      title={`Plan a hike with ${p.name}`}
                    >
                      <PlusIcon className="size-3" /> {p.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
      <PlanDialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        personId={personId}
        personName={personName}
        candidates={pickable(dialog?.plan)}
        plan={dialog?.plan}
        initialPeakIds={dialog?.peakIds}
        defaultSeason={defaultSeason}
      />
    </Card>
  )
}
