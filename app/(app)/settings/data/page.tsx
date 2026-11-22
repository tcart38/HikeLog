import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { ExportPanel, WeatherBackfill } from "@/components/settings/export-panel"
import { ImportPanel } from "@/components/settings/import-panel"
import { Section } from "@/components/settings/section"
import { get } from "@/lib/db"
import { listPeople, requireUser } from "@/lib/queries"
import { hikesMissingWeather } from "@/lib/weather"

export const metadata: Metadata = { title: "Import & export" }

export default async function SettingsDataPage() {
  const user = await requireUser()
  const people = listPeople()
  const mediaCount = get<{ n: number }>("SELECT COUNT(*) n FROM hike_media")!.n
  const missing = hikesMissingWeather(1).remaining + hikesMissingWeather(1).ids.length

  return (
    <>
      <PageHeader title="Import & export" description="Bring your log in, take your data out, and fill in weather." />
      <div className="flex max-w-3xl flex-col gap-8">
        <Section id="export" title="Export your data" description="Your data is yours. Download it any time.">
          <ExportPanel isAdmin={!!user.is_admin} mediaCount={mediaCount} />
        </Section>
        <Section id="weather" title="Weather" description="Hikes get daily temperature, wind and snowfall from Open-Meteo, looked up at the highest peak on the hike. You can also import it one hike at a time from a hike's page. Mountain Forecast doesn't offer an API, so it isn't used.">
          <WeatherBackfill missing={missing} />
        </Section>
        <Section id="import" title="Import a spreadsheet" description="Bring in an existing hiking log. You'll see exactly what will be created before anything is saved.">
          <ImportPanel people={people.map((p) => ({ id: p.id, name: p.name }))} defaultPersonId={user.person_id} />
        </Section>
      </div>
    </>
  )
}
