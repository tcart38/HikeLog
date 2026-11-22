"use client"

import * as React from "react"
import { toast } from "sonner"

import type { SectionPick } from "@/components/map/map-explorer"
import type { HikeOption, TrailInfo } from "@/components/map/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/client/api"

const MI = 1609.344

/** The selected trail: how much of it a person has hiked, and manual redlining for hikes without GPS. */
export function TrailCard({
  trail,
  personId,
  personName,
  hikes,
  section,
  setSection,
  onChanged,
}: {
  trail: TrailInfo
  personId: number
  personName: string
  hikes: HikeOption[]
  section: SectionPick
  setSection: (s: SectionPick) => void
  onChanged: () => void
}) {
  const [date, setDate] = React.useState("")
  const [hikeId, setHikeId] = React.useState("none")
  const [busy, setBusy] = React.useState(false)

  const totalM = trail.segments.reduce((a, s) => a + s.lengthM, 0)
  const mine = (s: TrailInfo["segments"][number]) => s.coveredBy.some((c) => c.person === personId)
  const coveredM = trail.segments.reduce((a, s) => a + (mine(s) ? s.lengthM : 0), 0)
  const pct = totalM ? Math.round((coveredM / totalM) * 100) : 0
  const manualM = trail.segments.reduce((a, s) => a + (s.coveredBy.some((c) => c.person === personId && c.source === "manual") ? s.lengthM : 0), 0)

  const range = section && section.a != null ? [Math.min(section.a, section.b ?? section.a), Math.max(section.a, section.b ?? section.a)] : null
  const rangeM = range ? trail.segments.filter((s) => s.idx >= range[0] && s.idx <= range[1]).reduce((a, s) => a + s.lengthM, 0) : 0

  const submit = async (covered: boolean, whole: boolean) => {
    setBusy(true)
    try {
      await api("/api/v1/coverage/manual", {
        body: {
          trailId: trail.trail.id,
          person: personId,
          covered,
          ...(whole || !range ? {} : { fromIdx: range[0], toIdx: range[1] }),
          date: date || null,
          hikeId: hikeId === "none" ? null : Number(hikeId),
        },
      })
      toast.success(covered ? `Marked as hiked for ${personName}` : `Cleared manual marks for ${personName}`)
      setSection(null)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  const hikeItems = [{ value: "none", label: "No hike linked" }, ...hikes.map((h) => ({ value: String(h.id), label: h.label }))]
  return (
    <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-medium text-balance">{trail.trail.name}</h3>
        <p className="text-sm text-muted-foreground tnum">
          {trail.trail.lengthMi.toFixed(1)} mi · {personName} has hiked <span className="font-medium text-foreground">{pct}%</span> ({(coveredM / MI).toFixed(1)} mi)
          {manualM > 0 && <span> · {(manualM / MI).toFixed(1)} mi marked by hand</span>}
        </p>
      </div>

      {section ? (
        <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-2.5 text-sm">
          <p className="font-medium">Pick a section</p>
          <p className="text-xs text-muted-foreground">
            {section.a == null
              ? "Tap the trail where the section starts."
              : section.b == null
                ? "Now tap where it ends."
                : `${(rangeM / MI).toFixed(2)} mi selected. Tap again to start over.`}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Date (optional)
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 md:h-8" />
        </label>
        <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Hike (optional)
          <Select items={hikeItems} value={hikeId} onValueChange={(v) => setHikeId(String(v))}>
            <SelectTrigger aria-label="Link to a hike" className="h-10 w-full md:h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-56">
              {hikeItems.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  {h.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {section && range ? (
          <>
            <Button className="h-10 md:h-8" disabled={busy} onClick={() => submit(true, false)}>
              Mark section hiked
            </Button>
            <Button variant="outline" className="h-10 md:h-8" disabled={busy} onClick={() => submit(false, false)}>
              Unmark section
            </Button>
          </>
        ) : (
          <>
            <Button className="h-10 md:h-8" disabled={busy || pct === 100} onClick={() => submit(true, true)}>
              Mark whole trail hiked
            </Button>
            {manualM > 0 && (
              <Button variant="outline" className="h-10 md:h-8" disabled={busy} onClick={() => submit(false, true)}>
                Clear my marks
              </Button>
            )}
          </>
        )}
        <Button variant={section ? "ghost" : "outline"} className="h-10 md:h-8" disabled={busy} onClick={() => setSection(section ? null : { a: null, b: null })}>
          {section ? "Cancel" : "Mark a section"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">GPS tracks mark trails automatically. Use this for older hikes without a track. Marks by hand count the same.</p>
    </div>
  )
}
