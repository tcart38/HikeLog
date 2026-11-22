"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { ParamSelect, useParamSetter, type Option } from "@/components/url-controls"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

export function HikeFilters({
  q,
  person,
  list,
  people,
  lists,
}: {
  q: string
  person: string
  list: string
  people: Option[]
  lists: Option[]
}) {
  const { set } = useParamSetter()
  const [text, setText] = React.useState(q)
  React.useEffect(() => {
    if (text === q) return
    const t = setTimeout(() => set({ q: text.trim() || null, page: null }), 300)
    return () => clearTimeout(t)
  }, [text, q, set])

  const active = !!(q || person || list)
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <InputGroup className="h-10 md:h-8 md:max-w-xs">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          placeholder="Search peaks, notes, weather"
          aria-label="Search hikes"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </InputGroup>
      <div className="grid grid-cols-2 gap-2 md:flex">
        <ParamSelect param="person" label="Person" value={person || "any"} options={[{ value: "any", label: "Anyone" }, ...people]} className="w-full md:w-40" />
        <ParamSelect param="list" label="List" value={list || "any"} options={[{ value: "any", label: "Any list" }, ...lists]} className="w-full md:w-48" />
      </div>
      {active && (
        <Button variant="ghost" className="h-10 md:h-8" onClick={() => { setText(""); set({ q: null, person: null, list: null, page: null }) }}>
          <XIcon /> Clear
        </Button>
      )}
    </div>
  )
}
