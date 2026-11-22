import type { Metadata } from "next"

import { ActivityCard } from "@/components/garmin/activity-card"
import { ConnectionPanel } from "@/components/garmin/connection-panel"
import { PageHeader } from "@/components/page-header"
import { listGarminActivities, connectionStatus } from "@/lib/garmin/sync"
import { listLists } from "@/lib/progress"
import { listPeople, peakOptions, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Garmin import" }
export const dynamic = "force-dynamic"

export default async function GarminPage() {
  const user = await requireUser()
  const status = connectionStatus(user.id)
  const pending = status.connected ? listGarminActivities(user.id, "pending") : []
  const peaks = pending.length ? peakOptions() : []
  const lists = pending.length ? listLists().map((l) => ({ slug: l.slug, label: l.short_name || l.name })) : []
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }))

  return (
    <>
      <PageHeader
        title="Garmin import"
        description="Pull hikes from your Garmin account, check the peaks, and add them to your log."
      />
      <div className="flex max-w-3xl flex-col gap-8">
        <ConnectionPanel status={{ ...status }} />
        {status.connected && (
          <section aria-labelledby="inbox-h" className="flex flex-col gap-4 border-t pt-6">
            <h2 id="inbox-h" className="text-base font-medium">
              To review{pending.length ? ` (${pending.length})` : ""}
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting. Hit Sync now to look for new hikes.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {pending.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={{
                      id: a.id,
                      startDate: a.start_date,
                      name: a.name,
                      type: a.type,
                      distanceMi: a.distance_mi,
                      elevationGainFt: a.elevation_gain_ft,
                      durationMin: a.duration_min,
                      status: a.status,
                      suggestedPeaks: a.suggested_peaks,
                    }}
                    peaks={peaks}
                    lists={lists}
                    people={people}
                    myPersonId={user.person_id}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  )
}
