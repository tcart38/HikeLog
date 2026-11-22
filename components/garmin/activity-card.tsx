"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, GitMergeIcon, Loader2Icon, MountainIcon, RouteIcon, TimerIcon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"

import { ParticipantsPicker, type Participant, type PersonOption } from "@/components/participants-picker"
import { PeakPicker, type PickerList, type PickerPeak } from "@/components/peak-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/client/api"
import { fmtDate, fmtDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { GarminActivityView, HikeMatchView } from "./types"

export function ActivityCard({
  activity,
  peaks,
  lists,
  people,
  myPersonId,
}: {
  activity: GarminActivityView
  peaks: PickerPeak[]
  lists: PickerList[]
  people: PersonOption[]
  myPersonId: number | null
}) {
  const router = useRouter()
  const suggested = activity.suggestedPeaks
  const [on, setOn] = React.useState<Set<number>>(() => new Set(suggested.map((s) => s.id)))
  const [extra, setExtra] = React.useState<PickerPeak[]>([])
  const [parts, setParts] = React.useState<Participant[]>(() => {
    const me = people.find((p) => p.id === myPersonId)
    return me ? [{ key: `p${me.id}`, id: me.id, name: me.name, counts: true }] : []
  })
  const [busy, setBusy] = React.useState<string | null>(null)
  const [addPeaks, setAddPeaks] = React.useState<Record<number, number[]>>({})
  const matches = activity.matches ?? []

  const peakIds = [...new Set([...on, ...extra.map((p) => p.id)])]

  async function act(kind: "import" | "ignore") {
    setBusy(kind)
    try {
      if (kind === "import") {
        await api(`/api/v1/garmin/activities/${activity.id}/import`, {
          body: {
            peaks: peakIds,
            participants: parts.map((p) => ({ person: p.id ?? p.name, counts: p.counts })),
          },
        })
        toast.success("Hike imported")
      } else {
        await api(`/api/v1/garmin/activities/${activity.id}/ignore`, { body: {} })
        toast.success("Ignored")
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.")
      setBusy(null)
    }
  }

  async function merge(m: HikeMatchView) {
    setBusy(`merge${m.hikeId}`)
    try {
      await api(`/api/v1/garmin/activities/${activity.id}/merge`, { body: { hikeId: m.hikeId, addPeaks: addPeaks[m.hikeId] ?? [] } })
      toast.success("Merged into your existing hike")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.")
      setBusy(null)
    }
  }

  const duration = fmtDuration(activity.durationMin)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">{activity.name || "Untitled activity"}</CardTitle>
        <p className="text-sm text-muted-foreground tnum">{fmtDate(activity.startDate, { weekday: true })}{activity.source ? ` · ${activity.source}` : ""}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-muted-foreground tnum">
          {activity.distanceMi != null && (
            <span className="inline-flex items-center gap-1"><RouteIcon className="size-3.5" />{activity.distanceMi.toFixed(1)} mi</span>
          )}
          {activity.elevationGainFt != null && (
            <span className="inline-flex items-center gap-1"><TrendingUpIcon className="size-3.5" />{activity.elevationGainFt.toLocaleString("en-US")} ft</span>
          )}
          {duration && <span className="inline-flex items-center gap-1"><TimerIcon className="size-3.5" />{duration}</span>}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {matches.map((m) => {
          const label = m.title || m.peaks.map((p) => p.name).join(", ") || "Untitled hike"
          const chosen = addPeaks[m.hikeId] ?? []
          return (
            <div key={m.hikeId} className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <GitMergeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium text-balance">Possible match: {label}</p>
                  <p className="text-xs text-muted-foreground tnum">
                    {fmtDate(m.date, { weekday: true })} · {m.reasons.join(" · ")}
                    {m.hasTrack ? " · already has a GPS track" : ""}
                  </p>
                </div>
              </div>
              {m.newPeaks.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Also add:</span>
                  {m.newPeaks.map((p) => {
                    const pressed = chosen.includes(p.id)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={pressed}
                        onClick={() => setAddPeaks((prev) => ({ ...prev, [m.hikeId]: pressed ? chosen.filter((x) => x !== p.id) : [...chosen, p.id] }))}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          pressed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"
                        )}
                      >
                        {pressed && <CheckIcon className="size-3.5" />}
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Merging adds the GPS track and fills in blank stats. Nothing already logged is changed.</p>
              <div>
                <Button className="h-11 w-full md:h-8 md:w-auto" onClick={() => merge(m)} disabled={busy !== null}>
                  {busy === `merge${m.hikeId}` ? <Loader2Icon className="animate-spin" /> : <GitMergeIcon />} Merge into this hike
                </Button>
              </div>
            </div>
          )
        })}
        {activity.hasTrack === false && (
          <p className="text-xs text-muted-foreground">
            No GPS track came with this activity, so peaks come from the title only. Upload its GPX/FIT file or use Garmin (login) to get the track.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Peaks</h3>
          {suggested.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Suggested peaks">
              {suggested.map((s) => {
                const pressed = on.has(s.id)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      title={s.detail}
                      onClick={() =>
                        setOn((prev) => {
                          const n = new Set(prev)
                          if (n.has(s.id)) n.delete(s.id)
                          else n.add(s.id)
                          return n
                        })
                      }
                      className={cn(
                        "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-3",
                        pressed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {pressed ? <CheckIcon className="size-4" /> : <MountainIcon className="size-4" />}
                      {s.name}
                      <span className="text-xs opacity-80">{s.reason === "track" ? "GPS" : "title"}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No peaks detected. Search below to add any you climbed.</p>
          )}
          <PeakPicker
            peaks={peaks}
            lists={lists}
            value={extra}
            onChange={setExtra}
            unmatched={[]}
            onRemoveUnmatched={() => {}}
          />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Who was on it</h3>
          <ParticipantsPicker people={people} value={parts} onChange={setParts} />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant={matches.length ? "outline" : "default"} className="h-11 flex-1 md:h-8 md:flex-none" onClick={() => act("import")} disabled={busy !== null}>
            {busy === "import" && <Loader2Icon className="animate-spin" />} {matches.length ? "Keep as new hike" : "Import hike"}
          </Button>
          <Button variant="outline" className="h-11 flex-1 md:h-8 md:flex-none" onClick={() => act("ignore")} disabled={busy !== null}>
            {matches.length ? "Skip" : "Ignore"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
