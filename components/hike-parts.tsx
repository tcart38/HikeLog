import Link from "next/link"
import { CloudSnowIcon, RouteIcon, TrendingUpIcon, UsersIcon } from "lucide-react"

import { SeasonBadge, WinterCountsBadge } from "@/components/season-badge"
import { CONDITION_LABEL, fmtRange } from "@/lib/format"
import type { Hike } from "@/lib/hikes"
import { cn } from "@/lib/utils"

export function hikeTitle(h: Hike) {
  if (h.title) return h.title
  const names = h.peaks.map((p) => p.name).concat(h.unmatchedPeaks)
  if (!names.length) return "Hike"
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ")
}

export function HikeStats({ h, className }: { h: Hike; className?: string }) {
  const bits = [
    h.distanceMi != null && { icon: RouteIcon, text: `${h.distanceMi} mi` },
    h.elevationGainFt != null && { icon: TrendingUpIcon, text: `${h.elevationGainFt.toLocaleString("en-US")} ft` },
    h.conditions && { icon: CloudSnowIcon, text: CONDITION_LABEL[h.conditions] },
  ].filter(Boolean) as { icon: typeof RouteIcon; text: string }[]
  if (!bits.length) return null
  return (
    <span className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {bits.map((b) => (
        <span key={b.text} className="inline-flex items-center gap-1 tnum">
          <b.icon className="size-3.5" /> {b.text}
        </span>
      ))}
    </span>
  )
}

/** One hike as a tappable card (phone lists, dashboard, peak detail). */
export function HikeCard({ h, showPeople = true }: { h: Hike; showPeople?: boolean }) {
  return (
    <Link
      href={`/hikes/${h.id}`}
      className="flex flex-col gap-2 rounded-xl p-3.5 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 text-[15px] leading-snug font-medium">{hikeTitle(h)}</span>
        <SeasonBadge season={h.season} className="shrink-0" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="tnum">{fmtRange(h.date, h.endDate)}</span>
        {showPeople && h.participants.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" />
            {h.participants.map((p) => p.name).join(", ")}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <HikeStats h={h} />
        {h.isWinter && <WinterCountsBadge />}
      </div>
    </Link>
  )
}
