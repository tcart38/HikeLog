import type { Metadata } from "next"
import Link from "next/link"
import { GitCompareArrowsIcon, SettingsIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { initials } from "@/components/user-menu"
import { fmtDate, pct } from "@/lib/format"
import { allListsProgress } from "@/lib/progress"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "People" }

export default async function PeoplePage() {
  await requireUser()
  const people = listPeople()
  const headline = ["nh-48", "ne-67"]
  return (
    <>
      <PageHeader
        title="People"
        description="Everyone who hikes with you, with or without a login."
        actions={
          <>
            <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href="/compare" />}>
              <GitCompareArrowsIcon /> Compare
            </Button>
            <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href="/settings#people" />}>
              <SettingsIcon /> Manage
            </Button>
          </>
        }
      />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => {
          const prog = allListsProgress(p.id, "all").filter((r) => headline.includes(r.list.slug))
          return (
            <li key={p.id} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarFallback>{initials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.username && <Badge variant="secondary">Has login</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground tnum">
                    {p.hikes} {p.hikes === 1 ? "hike" : "hikes"}
                    {p.last_hike && ` · last ${fmtDate(p.last_hike)}`}
                  </div>
                </div>
              </div>
              {prog.length > 0 && (
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm tnum">
                  {prog.map((r) => (
                    <div key={r.list.id} className="flex items-baseline gap-1.5">
                      <dt className="text-muted-foreground">{r.list.short_name ?? r.list.name}</dt>
                      <dd className="font-medium">
                        {r.completed}/{r.total} <span className="text-xs font-normal text-muted-foreground">{pct(r.completed, r.total)}%</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-9 md:h-7" nativeButton={false} render={<Link href={`/lists?person=${p.id}`} />}>
                  Lists
                </Button>
                <Button variant="outline" size="sm" className="h-9 md:h-7" nativeButton={false} render={<Link href={`/hikes?person=${p.id}`} />}>
                  Hikes
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
