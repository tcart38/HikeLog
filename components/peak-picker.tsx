"use client"

import * as React from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { fmtFt } from "@/lib/format"
import { normalizePeakName } from "@/lib/peaks/normalize"
import { cn } from "@/lib/utils"

export type PickerPeak = { id: number; name: string; elevationFt: number | null; state: string | null; lists: string[] }
export type PickerList = { slug: string; label: string }

const MAX_SHOWN = 60

function PeakCommand({
  peaks,
  lists,
  selected,
  onToggle,
}: {
  peaks: PickerPeak[]
  lists: PickerList[]
  selected: Set<number>
  onToggle: (p: PickerPeak) => void
}) {
  const [q, setQ] = React.useState("")
  const [list, setList] = React.useState("any")
  const items = [{ value: "any", label: "All peaks" }, ...lists.map((l) => ({ value: l.slug, label: l.label }))]
  const labelOf = React.useMemo(() => new Map(lists.map((l) => [l.slug, l.label])), [lists])

  const { shown, total } = React.useMemo(() => {
    const nq = normalizePeakName(q)
    const tokens = nq.split(" ").filter(Boolean)
    const pool = list === "any" ? peaks : peaks.filter((p) => p.lists.includes(list))
    const matched = tokens.length
      ? pool.filter((p) => {
          const n = normalizePeakName(p.name)
          return tokens.every((t) => n.includes(t))
        })
      : pool
    return { shown: matched.slice(0, MAX_SHOWN), total: matched.length }
  }, [q, list, peaks])

  return (
    <Command shouldFilter={false} className="h-full p-0">
      <div className="flex flex-col gap-2 p-2 pb-0">
        <CommandInput placeholder="Search peaks, e.g. Owl's Head" value={q} onValueChange={setQ} autoFocus />
        <Select items={items} value={list} onValueChange={(v) => setList(String(v))}>
          <SelectTrigger aria-label="Filter by list" className="h-10 w-full md:h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <CommandList className="max-h-none flex-1 md:max-h-80">
        <CommandEmpty>No peak matches &ldquo;{q}&rdquo;.</CommandEmpty>
        <CommandGroup>
          {shown.map((p) => {
            const on = selected.has(p.id)
            return (
              <CommandItem key={p.id} value={String(p.id)} data-checked={on} onSelect={() => onToggle(p)} className="min-h-11 md:min-h-9">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.lists
                      .slice(0, 3)
                      .map((s) => labelOf.get(s) ?? s)
                      .join(" · ")}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tnum">
                  {p.state} {fmtFt(p.elevationFt)}
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
        {total > MAX_SHOWN && <p className="px-3 py-2 text-center text-xs text-muted-foreground">Showing {MAX_SHOWN} of {total}. Keep typing to narrow it down.</p>}
      </CommandList>
    </Command>
  )
}

export function PeakPicker({
  peaks,
  lists,
  value,
  onChange,
  unmatched,
  onRemoveUnmatched,
}: {
  peaks: PickerPeak[]
  lists: PickerList[]
  value: PickerPeak[]
  onChange: (v: PickerPeak[]) => void
  unmatched: string[]
  onRemoveUnmatched: (name: string) => void
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = React.useState(false)
  const selected = React.useMemo(() => new Set(value.map((p) => p.id)), [value])
  const toggle = (p: PickerPeak) => onChange(selected.has(p.id) ? value.filter((x) => x.id !== p.id) : [...value, p])
  const trigger = (
    <Button type="button" variant="outline" className="h-11 w-full justify-start md:h-9 md:w-fit" />
  )
  const body = <PeakCommand peaks={peaks} lists={lists} selected={selected} onToggle={toggle} />

  return (
    <div className="flex flex-col gap-3">
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={trigger}>
            <PlusIcon /> Add peaks
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton className="h-[85svh] gap-0 rounded-t-2xl p-0 pb-safe">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle>Add peaks</SheetTitle>
              <SheetDescription>{value.length ? `${value.length} selected. Tap to add or remove.` : "Tap peaks to add them."}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1">{body}</div>
            <div className="border-t p-3">
              <Button type="button" className="h-11 w-full" onClick={() => setOpen(false)}>
                Done{value.length ? ` (${value.length})` : ""}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={trigger}>
            <PlusIcon /> Add peaks
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[28rem] p-0">
            {body}
          </PopoverContent>
        </Popover>
      )}

      {(value.length > 0 || unmatched.length > 0) && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected peaks">
          {value.map((p) => (
            <li key={p.id}>
              <Badge variant="secondary" className="h-9 gap-2 pr-1 pl-3 text-sm md:h-7 md:pr-1 md:pl-2.5">
                {p.name}
                {p.elevationFt && <span className="text-xs text-muted-foreground tnum">{p.elevationFt.toLocaleString("en-US")}</span>}
                <button
                  type="button"
                  onClick={() => toggle(p)}
                  aria-label={`Remove ${p.name}`}
                  className="flex size-7 items-center justify-center rounded-full hover:bg-foreground/10 md:size-5"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
          {unmatched.map((n) => (
            <li key={n}>
              <Badge variant="outline" className={cn("h-9 gap-2 border-transparent bg-remaining pr-1 pl-3 text-sm text-remaining-foreground md:h-7 md:pr-1 md:pl-2.5")}>
                {n} <span className="text-xs">unmatched</span>
                <button
                  type="button"
                  onClick={() => onRemoveUnmatched(n)}
                  aria-label={`Remove ${n}`}
                  className="flex size-7 items-center justify-center rounded-full hover:bg-foreground/10 md:size-5"
                >
                  <XIcon className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
