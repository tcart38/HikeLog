"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VIEWS, type View } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Update URL search params (server components re-render with the new state). */
export function useParamSetter() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [pending, start] = React.useTransition()
  const set = React.useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k)
        else next.set(k, v)
      }
      const qs = next.toString()
      start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    },
    [router, pathname, sp]
  )
  return { set, pending }
}

export type Option = { value: string; label: string }

export function ParamSelect({
  param,
  value,
  options,
  label,
  className,
  size,
}: {
  param: string
  value: string
  options: Option[]
  label: string
  className?: string
  size?: "sm" | "default"
}) {
  const { set, pending } = useParamSetter()
  return (
    <Select items={options} value={value} onValueChange={(v) => set({ [param]: v === "any" ? null : v, page: null })}>
      <SelectTrigger aria-label={label} size={size} className={cn("h-10 min-w-36 md:h-8", pending && "opacity-70", className)}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="min-w-44">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function PersonSwitcher({ value, people, param = "person" }: { value: number; people: { id: number; name: string }[]; param?: string }) {
  return (
    <ParamSelect
      param={param}
      label="Person"
      value={String(value)}
      options={people.map((p) => ({ value: String(p.id), label: p.name }))}
    />
  )
}

export function ViewTabs({ value, views }: { value: View; views?: View[] }) {
  const { set } = useParamSetter()
  return (
    <div className="-mx-4 overflow-x-auto px-4 scroll-quiet md:mx-0 md:px-0">
      <Tabs value={value} onValueChange={(v) => set({ view: v === "all" ? null : String(v) })}>
        <TabsList className="group-data-horizontal/tabs:h-10 w-max md:group-data-horizontal/tabs:h-9">
          {VIEWS.filter((v) => !views || views.includes(v.value)).map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="px-3.5 md:px-3">
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}

export function LeftOnlySwitch({ checked }: { checked: boolean }) {
  const { set } = useParamSetter()
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium md:min-h-8">
      <Switch checked={checked} onCheckedChange={(c) => set({ left: c ? "1" : null })} />
      What&apos;s left
    </label>
  )
}

/** Small segmented control bound to a search param (dashboard mode, compare mode). */
export function ParamToggle({ param, value, options, label }: { param: string; value: string; options: Option[]; label: string }) {
  const { set } = useParamSetter()
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(v) => v[0] && set({ [param]: v[0] })}
      variant="outline"
      spacing={0}
      className="h-10 md:h-8"
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="h-full px-3 data-[pressed]:bg-muted data-[pressed]:text-foreground aria-pressed:bg-muted">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
