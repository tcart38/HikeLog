import Link from "next/link"

import { ChartCard, Sparse } from "@/components/stats/stat-ui"
import type { Core } from "@/lib/stats"

export function PartnersCard({ core }: { core: Core }) {
  const max = Math.max(1, ...core.partners.map((p) => p.hikes))
  const me = core.person
  return (
    <ChartCard title="Hiking partners" description={`Who ${me.name.split(" ")[0]} hikes with most, and how much your peak lists overlap.`}>
      {core.partners.length === 0 ? (
        <Sparse>No hikes with other people yet. Add participants to a hike and partners show up here.</Sparse>
      ) : (
        <ul className="flex flex-col gap-3">
          {core.partners.slice(0, 7).map((p) => (
            <li key={p.id} className="flex flex-col gap-1.5">
              <Link href={`/stats?person=${me.id}&with=${p.id}`} className="group flex items-baseline justify-between gap-3 text-sm focus-visible:ring-2 focus-visible:ring-ring">
                <span className="truncate font-medium group-hover:text-primary">{p.name}</span>
                <span className="shrink-0 tnum">
                  <span className="font-semibold">{p.hikes}</span> <span className="text-muted-foreground">hike{p.hikes === 1 ? "" : "s"}</span>
                </span>
              </Link>
              <div className="h-2 rounded-full bg-muted" role="img" aria-label={`${p.hikes} hikes together`}>
                <div className="h-full rounded-full" style={{ width: `${(p.hikes / max) * 100}%`, background: "var(--done)" }} />
              </div>
              <p className="text-xs text-muted-foreground tnum">
                {p.together} peak{p.together === 1 ? "" : "s"} together · {p.bothDone} done by both ({p.overlapPct}% overlap) · {p.onlyMe} only you · {p.onlyThem} only them
              </p>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  )
}
