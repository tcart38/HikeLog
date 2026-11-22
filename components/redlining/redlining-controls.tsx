"use client"

import { ParamSelect, useParamSetter } from "@/components/url-controls"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export function RedliningControls({
  people,
  selected,
  networks,
  network,
}: {
  people: { id: number; name: string }[]
  selected: number[]
  networks: { value: string; label: string }[]
  network: string
}) {
  const { set } = useParamSetter()
  return (
    <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10 md:flex-row md:flex-wrap md:items-center md:p-4">
      <div className="flex flex-col gap-1 md:contents">
        <span className="text-xs font-medium text-muted-foreground md:hidden">Region or guide</span>
        <ParamSelect param="network" label="Region or guide" value={network} options={networks} className="w-full md:w-72" />
      </div>
      <div className="flex flex-col gap-1 md:contents">
        <span className="text-xs font-medium text-muted-foreground">Whose progress?</span>
        <ToggleGroup
          aria-label="People"
          multiple
          value={selected.map(String)}
          onValueChange={(v) => v.length >= 1 && set({ people: v.join(","), page: null })}
          variant="outline"
          spacing={2}
          className="flex-wrap"
        >
          {people.map((p) => (
            <ToggleGroupItem
              key={p.id}
              value={String(p.id)}
              className="h-10 rounded-full px-4 data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground md:h-8 md:px-3"
            >
              {p.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  )
}
