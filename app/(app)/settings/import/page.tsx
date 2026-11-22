import type { Metadata } from "next"

import { ActivityCard } from "@/components/garmin/activity-card"
import { ConnectionPanel } from "@/components/garmin/connection-panel"
import { Caveats } from "@/components/import/caveats"
import { FilePanel } from "@/components/import/file-panel"
import { GarminConnectPanel } from "@/components/import/garmin-connect-panel"
import { SourceTabs, type SourceTab } from "@/components/import/source-tabs"
import { StravaPanel } from "@/components/import/strava-panel"
import { PageHeader } from "@/components/page-header"
import { baseUrl } from "@/lib/api"
import { connectionStatus, listGarminActivities } from "@/lib/garmin/sync"
import { findMatches } from "@/lib/import/match"
import { garminConnectStatus } from "@/lib/import/garmin-connect"
import { SOURCES, sourceLabel, type SourceId } from "@/lib/import/meta"
import { stravaAuthorizeUrl, stravaStatus, STRAVA_SETTINGS_URL } from "@/lib/import/strava"
import { listLists } from "@/lib/progress"
import { listPeople, peakOptions, requireUser } from "@/lib/queries"
import { headers } from "next/headers"

export const metadata: Metadata = { title: "Activity import" }
export const dynamic = "force-dynamic"

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ source?: string; strava?: string }> }) {
  const user = await requireUser()
  const sp = await searchParams
  const h = await headers()
  const base = baseUrl(new Request("http://x/", { headers: h }))

  const garmin = connectionStatus(user.id)
  const gc = garminConnectStatus(user.id)
  const st = stravaStatus(user.id)
  const callback = `${base}/api/v1/import/strava/callback`

  const pending = listGarminActivities(user.id, "pending")
  const peaks = pending.length ? peakOptions() : []
  const lists = pending.length ? listLists().map((l) => ({ slug: l.slug, label: l.short_name || l.name })) : []
  const people = listPeople().map((p) => ({ id: p.id, name: p.name }))

  const connected: Record<SourceId, boolean> = { garmin: garmin.connected, garmin_connect: gc.state === "connected", strava: st.state === "connected", file: false }
  const initial = (SOURCES.find((s) => s.id === sp.source)?.id ?? SOURCES.find((s) => connected[s.id])?.id ?? "file") as SourceId
  const meta = Object.fromEntries(SOURCES.map((s) => [s.id, s])) as Record<SourceId, (typeof SOURCES)[number]>
  const tabs: SourceTab[] = SOURCES.map((s) => ({ id: s.id, label: s.short, connected: connected[s.id], unofficial: !s.official }))

  const panels: Record<SourceId, React.ReactNode> = {
    garmin: (
      <>
        <Caveats source={meta.garmin} />
        <ConnectionPanel status={{ ...garmin }} />
      </>
    ),
    garmin_connect: (
      <>
        <Caveats source={meta.garmin_connect} />
        <GarminConnectPanel status={gc} />
      </>
    ),
    strava: (
      <>
        <Caveats source={meta.strava} />
        <StravaPanel
          notice={sp.strava}
          status={{
            ...st,
            meta: st.state === "none" ? undefined : (st.meta as { athlete?: string | null }),
            lastSyncAt: st.state === "none" ? null : st.lastSyncAt,
            lastError: st.state === "none" ? null : st.lastError,
            settingsUrl: STRAVA_SETTINGS_URL,
            callbackDomain: new URL(callback).hostname,
            authorizeUrl: st.state === "none" ? null : stravaAuthorizeUrl(user.id, callback),
            authorizeUrlLocalhost: st.state === "none" ? null : stravaAuthorizeUrl(user.id, "http://localhost/hikelog"),
          }}
        />
      </>
    ),
    file: (
      <>
        <Caveats source={meta.file} />
        <FilePanel />
      </>
    ),
  }

  return (
    <>
      <PageHeader title="Activity import" description="Choose where your hikes come from. Activities from any source land in one list to review, with suggested peaks to confirm." />
      <div className="flex max-w-3xl flex-col gap-8">
        <SourceTabs tabs={tabs} initial={initial} panels={panels} />
        <section aria-labelledby="inbox-h" className="flex flex-col gap-4 border-t pt-6">
          <h2 id="inbox-h" className="text-base font-medium">
            To review{pending.length ? ` (${pending.length})` : ""}
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting. Sync a source or upload files to look for new hikes.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {pending.map((a) => (
                <ActivityCard
                  key={a.id}
                  activity={{
                    id: a.id,
                    source: sourceLabel(a.source),
                    startDate: a.start_date,
                    name: a.name,
                    type: a.type,
                    distanceMi: a.distance_mi,
                    elevationGainFt: a.elevation_gain_ft,
                    durationMin: a.duration_min,
                    status: a.status,
                    suggestedPeaks: a.suggested_peaks,
                    matches: findMatches(user, a),
                    hasTrack: !!a.has_track,
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
      </div>
    </>
  )
}
