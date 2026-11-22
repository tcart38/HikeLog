import type { Metadata } from "next"

import { HikeForm } from "@/components/hike-form"
import { PageHeader } from "@/components/page-header"
import { appTimeZone } from "@/lib/seasons"
import { listLists } from "@/lib/progress"
import { listPeople, peakOptions, requireUser, todayLocal } from "@/lib/queries"

export const metadata: Metadata = { title: "Log a hike" }

export default async function NewHikePage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader title="Log a hike" description="Every list these peaks are on updates for everyone you mark as there." />
      <HikeForm
        today={todayLocal()}
        timeZone={appTimeZone()}
        peaks={peakOptions()}
        lists={listLists().map((l) => ({ slug: l.slug, label: l.short_name || l.name }))}
        people={listPeople().map((p) => ({ id: p.id, name: p.name }))}
        defaultPersonId={user.person_id}
      />
    </>
  )
}
