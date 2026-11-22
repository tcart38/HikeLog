"use client"

import * as React from "react"
import { CheckIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type Participant = { key: string; id?: number; name: string; counts: boolean }
export type PersonOption = { id: number; name: string }

/** Everyone is one tap away; "add new person" for friends who aren't in the app yet. */
export function ParticipantsPicker({
  people,
  value,
  onChange,
}: {
  people: PersonOption[]
  value: Participant[]
  onChange: (v: Participant[]) => void
}) {
  const [name, setName] = React.useState("")
  const [showCredit, setShowCredit] = React.useState(value.some((p) => !p.counts))
  const isOn = (p: PersonOption) => value.some((v) => v.id === p.id)
  const toggle = (p: PersonOption) =>
    onChange(isOn(p) ? value.filter((v) => v.id !== p.id) : [...value, { key: `p${p.id}`, id: p.id, name: p.name, counts: true }])

  function add() {
    const n = name.trim()
    if (!n) return
    const existing = people.find((p) => p.name.toLowerCase() === n.toLowerCase())
    if (existing) {
      if (!isOn(existing)) toggle(existing)
    } else if (!value.some((v) => !v.id && v.name.toLowerCase() === n.toLowerCase())) {
      onChange([...value, { key: `n${n}`, name: n, counts: true }])
    }
    setName("")
  }

  const extra = value.filter((v) => !v.id)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-2" aria-label="People on this hike">
        {people.map((p) => {
          const on = isOn(p)
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p)}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-3",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background hover:bg-muted"
                )}
              >
                {on && <CheckIcon className="size-4" />}
                {p.name}
              </button>
            </li>
          )
        })}
        {extra.map((p) => (
          <li key={p.key}>
            <button
              type="button"
              aria-pressed
              onClick={() => onChange(value.filter((v) => v.key !== p.key))}
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:px-3"
            >
              <CheckIcon className="size-4" />
              {p.name} <span className="text-xs opacity-80">new</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add someone new"
          aria-label="Add a new person"
          autoComplete="off"
          className="h-11 max-w-60 md:h-8"
        />
        <Button type="button" variant="outline" className="h-11 md:h-8" onClick={add} disabled={!name.trim()}>
          <PlusIcon /> Add
        </Button>
      </div>
      {value.length > 1 &&
        (showCredit ? (
          <fieldset className="flex flex-col gap-1 rounded-lg bg-muted/50 p-3">
            <legend className="px-1 text-xs text-muted-foreground">Gets credit for the peaks</legend>
            {value.map((p) => (
              <label key={p.key} className="flex min-h-9 items-center gap-2.5 text-sm">
                <Checkbox checked={p.counts} onCheckedChange={(c) => onChange(value.map((v) => (v.key === p.key ? { ...v, counts: !!c } : v)))} />
                {p.name}
              </label>
            ))}
          </fieldset>
        ) : (
          <button type="button" onClick={() => setShowCredit(true)} className="min-h-9 w-fit text-left text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Someone turned around? Change who gets credit
          </button>
        ))}
    </div>
  )
}
