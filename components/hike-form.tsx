"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { ParticipantsPicker, type Participant, type PersonOption } from "@/components/participants-picker"
import { PeakPicker, type PickerList, type PickerPeak } from "@/components/peak-picker"
import { SeasonBadge } from "@/components/season-badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/client/api"
import { isWinterHike, seasonOf } from "@/lib/seasons"
import { cn } from "@/lib/utils"

export type HikeFormInitial = {
  id: number
  date: string
  endDate: string | null
  title: string | null
  peakIds: number[]
  unmatched: string[]
  participants: { id: number; name: string; counts: boolean }[]
  conditions: "snow" | "no_snow" | "mix" | null
  weather: string | null
  trailConditions: string | null
  notes: string | null
  distanceMi: number | null
  elevationGainFt: number | null
  durationMin: number | null
  routeType: string | null
  otherLists: string | null
}

const ROUTES = [
  { value: "none", label: "Not set" },
  { value: "loop", label: "Loop" },
  { value: "out_and_back", label: "Out and back" },
  { value: "traverse", label: "Traverse" },
  { value: "other", label: "Other" },
]
const CONDITIONS = [
  { value: "snow", label: "Snow" },
  { value: "no_snow", label: "No snow" },
  { value: "mix", label: "Mix" },
]

const num = (s: string) => (s.trim() === "" || Number.isNaN(Number(s)) ? null : Number(s))

export function HikeForm({
  today,
  timeZone,
  peaks,
  lists,
  people,
  defaultPersonId,
  initial,
}: {
  today: string
  /** Server's APP_TIMEZONE so the client's season/winter badges agree with the server. */
  timeZone: string
  peaks: PickerPeak[]
  lists: PickerList[]
  people: PersonOption[]
  defaultPersonId: number | null
  initial?: HikeFormInitial
}) {
  const router = useRouter()
  const byId = React.useMemo(() => new Map(peaks.map((p) => [p.id, p])), [peaks])

  const [date, setDate] = React.useState(initial?.date ?? today)
  const [multiDay, setMultiDay] = React.useState(!!initial?.endDate && initial.endDate !== initial.date)
  const [endDate, setEndDate] = React.useState(initial?.endDate ?? "")
  const [selPeaks, setSelPeaks] = React.useState<PickerPeak[]>(() => (initial?.peakIds ?? []).map((id) => byId.get(id)).filter(Boolean) as PickerPeak[])
  const [unmatched, setUnmatched] = React.useState<string[]>(initial?.unmatched ?? [])
  const [parts, setParts] = React.useState<Participant[]>(() =>
    initial
      ? initial.participants.map((p) => ({ key: `p${p.id}`, id: p.id, name: p.name, counts: p.counts }))
      : people.filter((p) => p.id === defaultPersonId).map((p) => ({ key: `p${p.id}`, id: p.id, name: p.name, counts: true }))
  )
  const [conditions, setConditions] = React.useState<string>(initial?.conditions ?? "")
  const [notes, setNotes] = React.useState(initial?.notes ?? "")
  const [title, setTitle] = React.useState(initial?.title ?? "")
  const [weather, setWeather] = React.useState(initial?.weather ?? "")
  const [trail, setTrail] = React.useState(initial?.trailConditions ?? "")
  const [miles, setMiles] = React.useState(initial?.distanceMi?.toString() ?? "")
  const [gain, setGain] = React.useState(initial?.elevationGainFt?.toString() ?? "")
  const [hours, setHours] = React.useState(initial?.durationMin ? String(Math.round((initial.durationMin / 60) * 100) / 100) : "")
  const [route, setRoute] = React.useState(initial?.routeType ?? "none")
  const [otherLists, setOtherLists] = React.useState(initial?.otherLists ?? "")
  const hasMore = !!(initial && (initial.title || initial.weather || initial.trailConditions || initial.distanceMi != null || initial.elevationGainFt != null || initial.durationMin || initial.routeType || initial.otherLists))
  const [showMore, setShowMore] = React.useState(hasMore)

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const end = multiDay && endDate ? endDate : null
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date)
  const season = valid ? seasonOf(date, timeZone) : null
  const winter = valid ? isWinterHike(date, end, timeZone) : false
  const endBeforeStart = !!end && end < date
  const crossesOut = valid && !!end && !endBeforeStart && seasonOf(date, timeZone) === "winter" && !winter

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!valid) return setError("Pick the date of the hike.")
    if (endBeforeStart) return setError("The end date is before the start date.")
    if (!parts.length) return setError("Choose who was on this hike.")
    if (!selPeaks.length && !unmatched.length && !title.trim()) return setError("Add at least one peak, or give the hike a title.")

    const body = {
      date,
      endDate: end,
      title: title.trim() || null,
      peaks: [...selPeaks.map((p) => p.id), ...unmatched],
      participants: parts.map((p) => ({ person: p.id ?? p.name, counts: p.counts })),
      conditions: conditions || null,
      weather: weather.trim() || null,
      trailConditions: trail.trim() || null,
      notes: notes.trim() || null,
      distanceMi: num(miles),
      elevationGainFt: num(gain) == null ? null : Math.round(num(gain)!),
      durationMin: num(hours) == null ? null : Math.round(num(hours)! * 60),
      routeType: route === "none" ? null : route,
      otherLists: otherLists.trim() || null,
    }
    setPending(true)
    try {
      const res = initial
        ? await api<{ hike: { id: number } }>(`/api/v1/hikes/${initial.id}`, { method: "PATCH", body })
        : await api<{ hike: { id: number } }>("/api/v1/hikes", { body })
      toast.success(initial ? "Hike updated" : "Hike logged")
      router.push(`/hikes/${res.hike.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the hike.")
      setPending(false)
    }
  }

  const tall = "h-11 md:h-8"
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="date">Date</FieldLabel>
            <div className="flex flex-wrap items-center gap-3">
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required className={cn(tall, "w-full sm:w-44")} />
              {season && (
                <span className="flex flex-wrap items-center gap-1.5" aria-live="polite">
                  <SeasonBadge season={season} />
                </span>
              )}
            </div>
            <label className="flex min-h-10 w-fit items-center gap-2 text-sm md:min-h-8">
              <Switch checked={multiDay} onCheckedChange={setMultiDay} />
              Multi-day trip
            </label>
            {multiDay && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="endDate">End date</FieldLabel>
                <Input id="endDate" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className={cn(tall, "w-full sm:w-44")} aria-invalid={endBeforeStart} />
              </div>
            )}
            {crossesOut && (
              <FieldDescription>This trip ends outside the winter it started in, so it won&apos;t count for winter lists.</FieldDescription>
            )}
          </Field>

          <Field>
            <FieldLabel>Peaks</FieldLabel>
            <PeakPicker
              peaks={peaks}
              lists={lists}
              value={selPeaks}
              onChange={setSelPeaks}
              unmatched={unmatched}
              onRemoveUnmatched={(n) => setUnmatched((u) => u.filter((x) => x !== n))}
            />
          </Field>

          <Field>
            <FieldLabel>Who was there</FieldLabel>
            <ParticipantsPicker people={people} value={parts} onChange={setParts} />
          </Field>
        </FieldGroup>

        <FieldGroup>
          <Field>
            <FieldLabel>Conditions</FieldLabel>
            <ToggleGroup
              aria-label="Conditions"
              value={conditions ? [conditions] : []}
              onValueChange={(v) => setConditions(v[0] ?? "")}
              variant="outline"
              spacing={0}
              className="h-11 w-full md:h-8 md:w-fit"
            >
              {CONDITIONS.map((c) => (
                <ToggleGroupItem key={c.value} value={c.value} className="h-full flex-1 px-4 data-[pressed]:bg-muted aria-pressed:bg-muted md:flex-none">
                  {c.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Trail, views, what to remember for next time" className="min-h-28" />
          </Field>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              aria-expanded={showMore}
              className="flex min-h-10 w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronDownIcon className={cn("size-4 transition-transform", showMore && "rotate-180")} />
              More details
            </button>
            {showMore && (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="title">Title</FieldLabel>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional. Defaults to the peak names." className={tall} />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field>
                    <FieldLabel htmlFor="miles">Miles</FieldLabel>
                    <Input id="miles" inputMode="decimal" value={miles} onChange={(e) => setMiles(e.target.value)} className={tall} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="gain">Gain (ft)</FieldLabel>
                    <Input id="gain" inputMode="numeric" value={gain} onChange={(e) => setGain(e.target.value)} className={tall} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="hours">Hours</FieldLabel>
                    <Input id="hours" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} className={tall} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="route">Route</FieldLabel>
                  <Select items={ROUTES} value={route} onValueChange={(v) => setRoute(String(v))}>
                    <SelectTrigger id="route" className="h-11 w-full sm:w-52 md:h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {ROUTES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="weather">Weather</FieldLabel>
                  <Input id="weather" value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Clear, 12F, light wind" className={tall} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="trail">Trail conditions</FieldLabel>
                  <Input id="trail" value={trail} onChange={(e) => setTrail(e.target.value)} placeholder="Packed out, microspikes" className={tall} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="otherLists">Other lists</FieldLabel>
                  <Input id="otherLists" value={otherLists} onChange={(e) => setOtherLists(e.target.value)} placeholder="Anything else you were checking off" className={tall} />
                </Field>
              </FieldGroup>
            )}
          </div>
        </FieldGroup>
      </div>

      {error && <FieldError role="alert">{error}</FieldError>}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <Button type="submit" size="lg" className="h-11 flex-1 md:h-9 md:flex-none md:px-5" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          {initial ? "Save changes" : "Log hike"}
        </Button>
        <Button type="button" variant="outline" size="lg" className="h-11 md:h-9" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
