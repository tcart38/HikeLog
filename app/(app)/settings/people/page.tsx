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
      <PageHeader title="People" description="Everyone who hikes with you. Hiking partners are just recorded on hikes. Turn on Compare for the people you also want to compare progress with." />
      <div className="max-w-3xl">
        <PeoplePanel people={people.map((p) => ({ id: p.id, name: p.name, username: p.username, hikes: p.hikes, canCompare: p.can_compare }))} />
      </div>
    </>
  )
}
