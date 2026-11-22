"use client"

import { ParamSelect, ParamToggle, useParamSetter } from "@/components/url-controls"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import { COMPARE_MODES } from "@/lib/format"

export function CompareControls({
  list,
  lists,
  mode,
  people,
  selected,
}: {
  list: string
  lists: { value: string; label: string }[]
  mode: string
  people: { id: number; name: string }[]
  selected: number[]
}) {
  const { set } = useParamSetter()
  return (
    <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10 md:flex-row md:flex-wrap md:items-center md:p-4">
      <div className="flex flex-col gap-1 md:contents">
        <span className="text-xs font-medium text-muted-foreground md:hidden">List</span>
        <ParamSelect param="list" label="List" value={list} options={lists} className="w-full md:w-56" />
      </div>
      <div className="flex flex-col gap-1 md:contents">
        <span className="text-xs font-medium text-muted-foreground md:hidden">Mode</span>
        <div className="-mx-3 overflow-x-auto px-3 md:mx-0 md:overflow-visible md:px-0">
          <ParamToggle param="mode" label="Mode" value={mode} options={COMPARE_MODES} />
        </div>
      </div>
      <div className="flex flex-col gap-1 md:contents">
        <span className="text-xs font-medium text-muted-foreground md:hidden">People (pick two or more)</span>
        <ToggleGroup
          aria-label="People to compare"
          multiple
          value={selected.map(String)}
          onValueChange={(v) => v.length >= 1 && set({ people: v.join(",") })}
          variant="outline"
          spacing={2}
          className="flex-wrap"
        >
          {people.map((p) => (
            <ToggleGroupItem key={p.id} value={String(p.id)} className="h-10 rounded-full px-4 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground md:h-8 md:px-3">
              {p.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
