"use client"

import Link from "next/link"
import { ExternalLinkIcon, Loader2Icon, XIcon } from "lucide-react"

import type { Layers, MapExplorerProps, SectionPick } from "@/components/map/map-explorer"
import { TrailCard } from "@/components/map/trail-card"
import type { Basemap } from "@/components/map/map-utils"
import type { MapNetwork, TrailInfo } from "@/components/map/types"
import { DownloadNetworkButton } from "@/components/redlining/download-button"
import { ParamSelect, useParamSetter } from "@/components/url-controls"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

export type PanelProps = MapExplorerProps & {
  layers: Layers
  setLayers: (l: Layers) => void
  basemap: Basemap
  setBasemap: (b: Basemap) => void
  everyone: boolean
  setEveryone: (v: boolean) => void
  trail: TrailInfo | null
  clearTrail: () => void
  section: SectionPick
  setSection: (s: SectionPick) => void
  refresh: () => void
  flyToBbox: (b: [number, number, number, number] | null) => void
  netState: "idle" | "loading" | "error"
  featureCount: number
  trackCount: number
}

const mi = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 })

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h2>
      {right}
    </div>
  )
}

function LayerRow({ label, hint, checked, onChange, swatch }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; swatch?: React.ReactNode }) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 text-sm md:min-h-8">
      <span className="flex min-w-0 items-center gap-2">
        {swatch}
        <span className="truncate font-medium">{label}</span>
        {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

export function NetworkProgress({ n, p, active }: { n: MapNetwork; p: PanelProps; active: boolean }) {
  const { set } = useParamSetter()
  const ordered = [...p.people].sort((a, b) => (a.id === p.personId ? -1 : b.id === p.personId ? 1 : 0))
  const cov = new Map(n.coverage.map((c) => [c.personId, c]))
  return (
    <li className={cn("flex flex-col gap-2 rounded-xl p-3 ring-1 ring-foreground/10", active && "bg-primary/[0.05] ring-primary/40")}>
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          disabled={!n.downloaded}
          onClick={() => {
            set({ network: n.slug })
            p.setLayers({ ...p.layers, network: true })
            p.flyToBbox(n.bbox)
          }}
          className="min-w-0 text-left text-sm font-medium enabled:hover:underline"
        >
          {n.name}
          {n.downloaded && <span className="ml-1.5 text-xs font-normal text-muted-foreground tnum">{mi(n.totalMi)} mi</span>}
        </button>
        {n.downloaded && (
          <Link href={`/redlining?network=${n.slug}&people=${p.personId}`} aria-label={`${n.name} redlining details`} className="-m-2 p-2 text-muted-foreground hover:text-foreground">
            <ExternalLinkIcon className="size-4" />
          </Link>
        )}
      </div>
      {n.downloaded ? (
        <ul className="flex flex-col gap-2">
          {ordered.map((person) => {
            const c = cov.get(person.id)
            const pct = c?.percent ?? 0
            return (
              <li key={person.id} className="flex flex-col gap-1">
                <div className={cn("flex items-baseline justify-between gap-2 text-xs", person.id === p.personId ? "text-foreground" : "text-muted-foreground")}>
                  <span className="flex items-center gap-1.5 font-medium">
                    <span className="size-2 rounded-full" style={{ background: person.color }} aria-hidden />
                    {person.name}
                  </span>
                  <span className="tnum">
                    <span className="font-semibold">{pct < 10 && pct > 0 ? pct.toFixed(1) : Math.round(pct)}%</span> · {mi(c?.coveredMi ?? 0)} of {mi(n.totalMi)} mi
                  </span>
                </div>
                <Progress value={pct} aria-label={`${person.name}: ${Math.round(pct)}% of ${n.name}`} className="gap-0 [&_[data-slot=progress-track]]:h-1.5" />
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Not downloaded yet</span>
          {p.isAdmin ? <DownloadNetworkButton slug={n.slug} name={n.name} size="sm" /> : <span>Ask an admin to download it</span>}
        </div>
      )}
    </li>
  )
}

export function MapPanel(p: PanelProps) {
  const person = p.people.find((x) => x.id === p.personId)
  const hasNetworks = p.networks.length > 0
  const groups = new Map<string, MapNetwork[]>()
  for (const n of p.networks) (groups.get(n.groupName ?? n.name) ?? groups.set(n.groupName ?? n.name, []).get(n.groupName ?? n.name)!).push(n)
  const active = p.networks.find((n) => n.slug === p.networkSlug)

  return (
    <div className="flex flex-col gap-6">
      {p.trail && (
        <section aria-label="Selected trail" className="flex flex-col gap-3">
          <Heading
            right={
              <Button variant="ghost" size="icon-sm" onClick={p.clearTrail} aria-label="Close trail details">
                <XIcon />
              </Button>
            }
          >
            Trail
          </Heading>
          <TrailCard trail={p.trail} personId={p.personId} personName={person?.name ?? ""} hikes={p.hikes} section={p.section} setSection={p.setSection} onChanged={p.refresh} />
        </section>
      )}

      <section aria-label="Who" className="flex flex-col gap-2">
        <Heading>Showing progress for</Heading>
        <ParamSelect param="person" label="Person" value={String(p.personId)} options={p.people.map((x) => ({ value: String(x.id), label: x.name }))} className="w-full" />
      </section>

      <section aria-label="Layers" className="flex flex-col gap-1">
        <Heading>Layers</Heading>
        <LayerRow
          label="Peaks"
          hint={`${p.peaks.length} of ${p.peakTotal}`}
          checked={p.layers.peaks}
          onChange={(v) => p.setLayers({ ...p.layers, peaks: v })}
          swatch={<span className="size-3 rounded-full border-2 border-primary bg-primary" aria-hidden />}
        />
        <LayerRow
          label="GPS tracks"
          hint={p.trackCount ? `${p.trackCount} recorded` : "none yet"}
          checked={p.layers.tracks}
          onChange={(v) => p.setLayers({ ...p.layers, tracks: v })}
          swatch={<span className="h-0.5 w-3 rounded-full" style={{ background: person?.color }} aria-hidden />}
        />
        {p.layers.tracks && (
          <label className="ml-5 flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm text-muted-foreground md:min-h-7">
            Everyone&apos;s tracks
            <Switch size="sm" checked={p.everyone} onCheckedChange={p.setEveryone} aria-label="Show everyone's tracks" />
          </label>
        )}
        <LayerRow
          label="Trail coverage"
          hint={active ? active.name : "pick a network below"}
          checked={p.layers.network}
          onChange={(v) => p.setLayers({ ...p.layers, network: v })}
          swatch={<span className="h-0.5 w-3 rounded-full bg-primary" aria-hidden />}
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Basemap</span>
          <ToggleGroup aria-label="Basemap" value={[p.basemap]} onValueChange={(v) => v[0] && p.setBasemap(v[0] as Basemap)} variant="outline" spacing={0} className="h-10 md:h-8">
            <ToggleGroupItem value="streets" className="h-full px-3 data-[pressed]:bg-muted data-[pressed]:text-foreground aria-pressed:bg-muted">
              Streets
            </ToggleGroupItem>
            <ToggleGroupItem value="topo" className="h-full px-3 data-[pressed]:bg-muted data-[pressed]:text-foreground aria-pressed:bg-muted">
              Topo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </section>

      {p.layers.peaks && (
        <section aria-label="Peak filters" className="flex flex-col gap-2">
          <Heading>Peaks</Heading>
          <div className="grid grid-cols-2 gap-2">
            <ParamSelect param="list" label="List" value={p.listSlug} options={p.lists} className="w-full" />
            <ParamSelect param="mode" label="Mode" value={p.mode} options={p.modes} className="w-full" />
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 border-primary bg-primary" aria-hidden /> Done
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border-2 border-remaining-foreground bg-transparent" aria-hidden /> Still to do
            </span>
            {p.peaks.length < p.peakTotal && <span>{p.peakTotal - p.peaks.length} not on the map yet (no coordinates)</span>}
          </p>
        </section>
      )}

      <section aria-label="Trail networks" className="flex flex-col gap-2">
        <Heading right={<Link href="/redlining" className="text-xs font-medium text-primary hover:underline">Redlining</Link>}>Trail networks</Heading>
        {!hasNetworks && <p className="text-sm text-muted-foreground">No trail networks are defined.</p>}
        {[...groups.entries()].map(([group, items]) => (
          <div key={group} className="flex flex-col gap-2">
            {groups.size > 1 && items.length > 1 && <h3 className="mt-1 text-sm font-medium">{group}</h3>}
            <ul className="flex flex-col gap-2">
              {(items.length > 4 ? items.filter((n) => n.downloaded || n.slug === p.networkSlug) : items).map((n) => (
                <NetworkProgress key={n.slug} n={n} p={p} active={n.slug === p.networkSlug} />
              ))}
            </ul>
            {items.length > 4 && items.some((n) => !n.downloaded) && (
              <p className="text-xs text-muted-foreground">
                {items.filter((n) => !n.downloaded).length} more sections can be downloaded from{" "}
                <Link href="/redlining" className="font-medium text-primary hover:underline">
                  Redlining
                </Link>
                .
              </p>
            )}
          </div>
        ))}
        {p.netState === "loading" && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" /> Loading trails…
          </p>
        )}
        {p.netState === "error" && <p className="text-xs text-destructive">Could not load that network.</p>}
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-primary" aria-hidden /> Hiked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-muted-foreground" aria-hidden /> Not yet
          </span>
          <span>Tap a trail to mark it</span>
        </p>
      </section>
    </div>
  )
}

/** The always-visible strip of the phone sheet. */
export function PanelSummary(p: PanelProps) {
  const person = p.people.find((x) => x.id === p.personId)
  const n = p.networks.find((x) => x.slug === p.networkSlug && x.downloaded)
  const c = n?.coverage.find((x) => x.personId === p.personId)
  const done = p.peaks.filter((k) => k.done).length
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">
          {p.trail ? p.trail.trail.name : n && c ? `${person?.name}: ${Math.round(c.percent)}% of ${n.name}` : `${person?.name}: ${done} of ${p.peaks.length} peaks done`}
        </span>
        <span className="truncate text-xs text-muted-foreground tnum">
          {p.trail
            ? `${p.trail.trail.lengthMi.toFixed(1)} mi · tap the handle for details`
            : n && c
              ? `${mi(c.coveredMi)} of ${mi(n.totalMi)} mi`
              : "Drag up for layers and trail progress"}
        </span>
      </div>
      <ParamSelect param="person" label="Person" value={String(p.personId)} options={p.people.map((x) => ({ value: String(x.id), label: x.name }))} className="w-28 min-w-0 shrink-0" />
    </div>
  )
}
