import type { Metadata } from "next"
import Link from "next/link"
import { SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { ProgressBar } from "@/components/progress-bar"
import { PersonSwitcher } from "@/components/url-controls"
import { one } from "@/lib/format"
import { UserPrefs, listVisibility } from "@/lib/prefs"
import { allListsProgress } from "@/lib/progress"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Lists" }

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const user = await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const requested = Number(one(sp.person))
  const personId = people.find((p) => p.id === requested)?.id ?? user.person_id ?? people[0]?.id
  const person = people.find((p) => p.id === personId)
  const prefs = new UserPrefs(user.id)
  const vis = listVisibility(prefs, personId ?? null)
  const rows = personId ? allListsProgress(personId, "all").filter((r) => vis.visible(r.list.slug)) : []
  const winter = personId ? new Map(allListsProgress(personId, "winter").map((r) => [r.list.id, r])) : new Map()

  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = r.list.region || "Other"
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(r)
  }

  return (
    <>
      <PageHeader
        title="Lists"
        description={person ? `Lists ${person.name} has started` : undefined}
        actions={
          <>
            {personId ? <PersonSwitcher value={personId} people={people} /> : null}
            <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href="/settings/lists" />}>
              <SettingsIcon /> Manage lists
            </Button>
          </>
        }
      />
      {rows.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          <p>Nothing here yet. Lists show up once you log a peak on them, or you can turn any list on in settings.</p>
          <Button nativeButton={false} render={<Link href="/settings/lists" />}>
            Browse all lists
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-8">
        {[...groups.entries()].map(([region, items]) => (
          <section key={region} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{region}</h2>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map(({ list, completed, total }) => {
                const w = winter.get(list.id)
                const personQ = personId && personId !== user.person_id ? `?person=${personId}` : ""
                return (
                  <li key={list.id}>
                    <Link
                      href={`/lists/${list.slug}${personQ}`}
                      className="flex min-h-24 flex-col justify-between gap-3 rounded-xl p-4 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{list.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{list.organization ?? list.short_name}</div>
                        </div>
                        <div className="shrink-0 text-right text-sm tnum">
                          <span className="font-semibold">{completed}</span>
                          <span className="text-muted-foreground"> / {total}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <ProgressBar done={completed} total={total} label={`${list.name} progress`} />
                        {w && w.completed > 0 && prefs.views(list.slug).includes("winter") && (
                          <span className="text-xs text-muted-foreground tnum">
                            Winter {w.completed} / {w.total}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      {rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Don&apos;t see a list?{" "}
          <Link href="/settings/lists" className="font-medium text-primary hover:underline">
            Browse and turn on more lists
          </Link>
          .
        </p>
      )}
    </>
  )
}
