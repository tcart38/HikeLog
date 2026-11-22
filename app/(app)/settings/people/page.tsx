import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { PeoplePanel } from "@/components/settings/people-panel"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "People settings" }

export default async function SettingsPeoplePage() {
  await requireUser()
  const people = listPeople()
  return (
    <>
      <PageHeader title="People" description="Everyone who hikes with you. Merge duplicates, or add friends before they have a login." />
      <div className="max-w-3xl">
        <PeoplePanel people={people.map((p) => ({ id: p.id, name: p.name, username: p.username, hikes: p.hikes }))} />
      </div>
    </>
  )
}
