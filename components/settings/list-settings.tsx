"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/client/api"
import { VIEWS, type View } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ListSettingsRow = {
  slug: string
  name: string
  region: string
  started: boolean
  visible: boolean
  done: number
  total: number
  views: View[]
  customViews: boolean
}

type Filter = "all" | "shown" | "hidden"

const VIEW_HELP: Record<View, string> = {
  all: "Every peak, climbed or not",
  winter: "Winter ascents",
  season: "A peak in each season",
  grid: "A peak in each of the 12 months",
  conditions: "Snow, no snow, mix",
}

export function ListSettings({ rows, defaultViews }: { rows: ListSettingsRow[]; defaultViews: View[] }) {
  const router = useRouter()
  const [filter, setFilter] = React.useState<Filter>("all")
  const [q, setQ] = React.useState("")
  const [open, setOpen] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true)
    try {
      await api("/api/v1/me/lists", { method: "PATCH", body })
      router.refresh()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    } finally {
      setBusy(false)
    }
  }

  const setVisible = (r: ListSettingsRow, want: boolean) => patch({ list: r.slug, state: want === r.started ? "auto" : want ? "show" : "hide" })

  const toggleView = (r: ListSettingsRow, v: View, on: boolean) => {
    const next = VIEWS.map((x) => x.value).filter((x) => (x === v ? on : r.views.includes(x)))
    if (!next.length) return toast.error("Keep at least one view on")
    const same = next.length === defaultViews.length && next.every((x) => defaultViews.includes(x))
    return patch({ list: r.slug, views: same ? null : next })
  }

  const needle = q.trim().toLowerCase()
  const shown = rows.filter((r) => (filter === "all" || (filter === "shown" ? r.visible : !r.visible)) && (!needle || `${r.name} ${r.region}`.toLowerCase().includes(needle)))
  const groups = new Map<string, ListSettingsRow[]>()
  for (const r of shown) (groups.get(r.region) ?? groups.set(r.region, []).get(r.region)!).push(r)

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <section className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10" aria-labelledby="defviews-h">
        <div>
          <h2 id="defviews-h" className="text-base font-medium">
            Views for every list
          </h2>
          <p className="text-sm text-muted-foreground">Only interested in finishing lists? Turn off the views you don&apos;t want to see. You can still override any list below.</p>
        </div>
        <ToggleGroup
          aria-label="Default views"
          multiple
          value={defaultViews}
          onValueChange={(v) => (v.length ? patch({ views: v }) : toast.error("Keep at least one view on"))}
          variant="outline"
          spacing={0}
          className="h-10 w-fit flex-wrap md:h-8"
          disabled={busy}
        >
          {VIEWS.map((v) => (
            <ToggleGroupItem key={v.value} value={v.value} className="h-full px-3 data-[pressed]:bg-primary/10 data-[pressed]:text-primary aria-pressed:bg-primary/10">
              {v.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lists" aria-label="Search lists" className="h-10 w-full sm:w-64 md:h-8" />
        <ToggleGroup aria-label="Filter" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0] as Filter)} variant="outline" spacing={0} className="h-10 md:h-8">
          {(["all", "shown", "hidden"] as const).map((f) => (
            <ToggleGroupItem key={f} value={f} className="h-full px-3 capitalize data-[pressed]:bg-muted aria-pressed:bg-muted">
              {f === "hidden" ? "Not showing" : f === "shown" ? "Showing" : "All"}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {groups.size === 0 && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No lists match.</p>}
      {[...groups.entries()].map(([region, items]) => (
        <section key={region} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">{region}</h2>
          <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
            {items.map((r) => (
              <li key={r.slug} className="flex flex-col">
                <div className="flex min-h-14 items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/lists/${r.slug}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground tnum">
                      {r.started ? `${r.done} of ${r.total} done` : `${r.total} ${r.total === 1 ? "item" : "items"}, not started`}
                      {r.customViews && " · custom views"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-1 md:h-7"
                    aria-expanded={open === r.slug}
                    onClick={() => setOpen(open === r.slug ? null : r.slug)}
                  >
                    Views <ChevronDownIcon className={cn("transition-transform", open === r.slug && "rotate-180")} />
                  </Button>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only md:not-sr-only md:text-muted-foreground">Show</span>
                    <Switch checked={r.visible} disabled={busy} onCheckedChange={(c) => setVisible(r, c)} aria-label={`Show ${r.name}`} />
                  </label>
                </div>
                {open === r.slug && (
                  <div className="grid gap-2 border-t bg-muted/30 px-4 py-3 sm:grid-cols-2">
                    {VIEWS.map((v) => (
                      <label key={v.value} className="flex min-h-9 cursor-pointer items-center gap-3 text-sm">
                        <Checkbox checked={r.views.includes(v.value)} disabled={busy} onCheckedChange={(c) => toggleView(r, v.value, !!c)} />
                        <span>
                          <span className="font-medium">{v.label}</span>
                          <span className="block text-xs text-muted-foreground">{VIEW_HELP[v.value]}</span>
                        </span>
                      </label>
                    ))}
                    {r.customViews && (
                      <div className="sm:col-span-2">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => patch({ list: r.slug, views: null }, "Using your default views")}>
                          Use my default views
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
