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
    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
      <div className="min-w-0 [&_button]:w-full"><PersonSwitcher value={personId} people={people} /></div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-sm text-muted-foreground">vs</span>
        <ParamSelect
          param="with"
          label="Compare with"
          className="w-full min-w-0 sm:w-auto"
          value={withId ? String(withId) : "any"}
          options={[{ value: "any", label: "No one" }, ...people.filter((p) => p.id !== personId).map((p) => ({ value: String(p.id), label: p.name }))]}
        />
      </div>
      {years.length > 0 && (
        <ParamSelect param="year" label="Year" value={String(year)} options={[...years].reverse().map((y) => ({ value: String(y), label: String(y) }))} className="col-span-1 w-full min-w-24 sm:w-auto" />
      )}
    </div>
  )
}
