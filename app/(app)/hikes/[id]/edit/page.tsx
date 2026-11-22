import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HikeForm } from "@/components/hike-form"
import { PageHeader } from "@/components/page-header"
import { getHike } from "@/lib/hikes"
import { appTimeZone } from "@/lib/seasons"
import { listLists } from "@/lib/progress"
import { listPeople, peakOptions, requireUser, todayLocal } from "@/lib/queries"

export const metadata: Metadata = { title: "Edit hike" }

export default async function EditHikePage({ params }: PageProps<"/hikes/[id]/edit">) {
  const user = await requireUser()
  const { id } = await params
  const hike = Number(id) ? getHike(Number(id)) : null
  if (!hike) notFound()
  return (
    <>
      <PageHeader title="Edit hike" />
      <HikeForm
        today={todayLocal()}
        timeZone={appTimeZone()}
        peaks={peakOptions()}
        lists={listLists().map((l) => ({ slug: l.slug, label: l.short_name || l.name }))}
        people={listPeople().map((p) => ({ id: p.id, name: p.name }))}
        defaultPersonId={user.person_id}
        initial={{
          id: hike.id,
          date: hike.date,
          endDate: hike.endDate,
          title: hike.title,
          peakIds: hike.peaks.map((p) => p.id),
          unmatched: hike.unmatchedPeaks,
          participants: hike.participants.map((p) => ({ id: p.id, name: p.name, counts: p.counts })),
          conditions: hike.conditions,
          weather: hike.weather,
          trailConditions: hike.trailConditions,
          notes: hike.notes,
          distanceMi: hike.distanceMi,
          elevationGainFt: hike.elevationGainFt,
          durationMin: hike.durationMin,
          routeType: hike.routeType,
          otherLists: hike.otherLists,
        }}
      />
    </>
  )
}
