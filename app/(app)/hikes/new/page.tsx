import type { Metadata } from "next"

import { HikeForm } from "@/components/hike-form"
import { PageHeader } from "@/components/page-header"
import { getPlan } from "@/lib/planned"
import { appTimeZone } from "@/lib/seasons"
import { listLists } from "@/lib/progress"
import { listPeople, peakOptions, requireUser, todayLocal } from "@/lib/queries"
import { one } from "@/lib/format"

export const metadata: Metadata = { title: "Log a hike" }

export default async function NewHikePage({ searchParams }: PageProps<"/hikes/new">) {
  const user = await requireUser()
  const planId = Number(one((await searchParams).plan))
  const plan = planId ? getPlan(planId) : null
  const open = plan && !plan.doneAt ? plan : null
  return (
    <>
      <PageHeader title={open ? `Log ${open.name}` : "Log a hike"} description="Every list these peaks are on updates for everyone you mark as there." />
      <HikeForm
        today={todayLocal()}
        timeZone={appTimeZone()}
        peaks={peakOptions()}
        lists={listLists().map((l) => ({ slug: l.slug, label: l.short_name || l.name }))}
        people={listPeople().map((p) => ({ id: p.id, name: p.name }))}
        defaultPersonId={open?.personId ?? user.person_id}
        plan={open ? { id: open.id, name: open.name, targetDate: open.targetDate, notes: open.notes, peakIds: open.peaks.map((p) => p.id) } : undefined}
      />
    </>
  )
}
