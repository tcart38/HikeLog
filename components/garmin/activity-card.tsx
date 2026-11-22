"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, Loader2Icon, MountainIcon, RouteIcon, TimerIcon, TrendingUpIcon } from "lucide-react"
import { toast } from "sonner"

import { ParticipantsPicker, type Participant, type PersonOption } from "@/components/participants-picker"
import { PeakPicker, type PickerList, type PickerPeak } from "@/components/peak-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/client/api"
import { fmtDate, fmtDuration } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { GarminActivityView } from "./types"

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
  const [busy, setBusy] = React.useState<"import" | "ignore" | null>(null)

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
          <Button className="h-11 flex-1 md:h-8 md:flex-none" onClick={() => act("import")} disabled={busy !== null}>
            {busy === "import" && <Loader2Icon className="animate-spin" />} Import hike
          </Button>
          <Button variant="outline" className="h-11 flex-1 md:h-8 md:flex-none" onClick={() => act("ignore")} disabled={busy !== null}>
            Ignore
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
