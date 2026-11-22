"use client"

import { ParamSelect, PersonSwitcher } from "@/components/url-controls"

export function StatsControls({
  personId,
  withId,
  year,
  people,
  years,
}: {
  personId: number
  withId: number | null
  year: number
  people: { id: number; name: string }[]
  years: number[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PersonSwitcher value={personId} people={people} />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">vs</span>
        <ParamSelect
          param="with"
          label="Compare with"
          value={withId ? String(withId) : "any"}
          options={[{ value: "any", label: "No one" }, ...people.filter((p) => p.id !== personId).map((p) => ({ value: String(p.id), label: p.name }))]}
        />
      </div>
      {years.length > 0 && (
        <ParamSelect param="year" label="Year" value={String(year)} options={[...years].reverse().map((y) => ({ value: String(y), label: String(y) }))} className="min-w-24" />
      )}
    </div>
  )
}
