import type { Metadata } from "next"
import Link from "next/link"
import { ListChecksIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { PlanItem } from "@/components/planned-hikes"
import { PersonSwitcher } from "@/components/url-controls"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, EmptyContent } from "@/components/ui/empty"
import { Button } from "@/components/ui/button"
import { one } from "@/lib/format"
import { listPlans } from "@/lib/planned"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Planned hikes" }

export default async function PlannedPage({ searchParams }: PageProps<"/planned">) {
  const user = await requireUser()
  const sp = await searchParams
  const people = listPeople()
  const requested = Number(one(sp.person))
  const personId = people.find((p) => p.id === requested)?.id ?? user.person_id ?? people[0]?.id
  const person = people.find((p) => p.id === personId)
  const open = personId ? listPlans(personId) : []
  const done = personId ? listPlans(personId, { done: true }) : []
  const peaks = open.reduce((n, p) => n + p.peaks.length, 0)

  return (
    <>
      <PageHeader
        title="Planned hikes"
        description={person ? `${open.length} planned ${open.length === 1 ? "hike" : "hikes"} covering ${peaks} ${peaks === 1 ? "peak" : "peaks"} for ${person.name}.` : undefined}
        actions={personId ? <PersonSwitcher value={personId} people={people} /> : undefined}
      />

      {open.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>No hikes planned yet</EmptyTitle>
            <EmptyDescription>Open a peak list and group the peaks you still need into planned hikes. They&apos;ll show up here.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/lists" />}>
              <ListChecksIcon /> Browse lists
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map((p) => (
            <PlanItem key={p.id} plan={p} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Done ({done.length})</h2>
          {done.map((p) => (
            <PlanItem key={p.id} plan={p} />
          ))}
        </section>
      )}
    </>
  )
}
