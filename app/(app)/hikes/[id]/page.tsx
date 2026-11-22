import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, MapIcon, PencilIcon, TriangleAlertIcon } from "lucide-react"

import { DeleteHikeButton } from "@/components/delete-hike-button"
import { HikeMedia } from "@/components/hike-media"
import { HikeTrackActions } from "@/components/hike-track-actions"
import { HikeWeatherActions } from "@/components/hike-weather-actions"
import { HikeMapLoader } from "@/components/map/hike-map-loader"
import { hikeTitle } from "@/components/hike-parts"
import { PageHeader } from "@/components/page-header"
import { SeasonBadge, WinterCountsBadge } from "@/components/season-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CONDITION_LABEL, fmtDate, fmtDuration, fmtFt, fmtRange } from "@/lib/format"
import { hikeCoverageSummary } from "@/lib/coverage"
import { getHike } from "@/lib/hikes"
import { getTrack } from "@/lib/tracks"
import { listMedia } from "@/lib/media"
import { getWeather } from "@/lib/weather"
import { hikeLists, requireUser } from "@/lib/queries"

export async function generateMetadata({ params }: PageProps<"/hikes/[id]">): Promise<Metadata> {
  const { id } = await params
  const h = Number(id) ? getHike(Number(id)) : null
  return { title: h ? hikeTitle(h) : "Hike" }
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  if (children == null || children === "") return null
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tnum">{children}</dd>
    </div>
  )
}

export default async function HikePage({ params }: PageProps<"/hikes/[id]">) {
  await requireUser()
  const { id } = await params
  const hike = Number(id) ? getHike(Number(id)) : null
  if (!hike) notFound()
  const lists = hikeLists(hike.id)
  const track = getTrack(hike.id)
  const media = listMedia(hike.id)
  const weather = getWeather(hike.id)
  const trackNetworks = track ? hikeCoverageSummary(hike.id) : []
  const title = hikeTitle(hike)
  const crossesEquinox = !hike.isWinter && hike.endDate && hike.endDate !== hike.date && hike.season === "winter"

  return (
    <>
      <Link href="/hikes" className="inline-flex min-h-9 w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Hikes
      </Link>
      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tnum">{fmtRange(hike.date, hike.endDate)}</span>
            <SeasonBadge season={hike.season} />
            {hike.isWinter && <WinterCountsBadge />}
            {hike.conditions && <Badge variant="secondary">{CONDITION_LABEL[hike.conditions]}</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href={`/hikes/${hike.id}/edit`} />}>
              <PencilIcon /> Edit
            </Button>
            <DeleteHikeButton id={hike.id} label={title} />
          </>
        }
      />

      {crossesEquinox && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Doesn&apos;t count for winter</AlertTitle>
          <AlertDescription>A winter ascent has to start and end inside the same astronomical winter. This trip runs past the spring equinox.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-2" aria-labelledby="peaks-h">
            <h2 id="peaks-h" className="text-base font-medium">
              Peaks
            </h2>
            {hike.peaks.length === 0 && hike.unmatchedPeaks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No peaks on this hike. Edit it to add some.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-xl ring-1 ring-foreground/10">
                {hike.peaks.map((p) => (
                  <li key={p.id}>
                    <Link href={`/peaks/${p.slug}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50 first:rounded-t-xl last:rounded-b-xl">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-sm text-muted-foreground tnum">
                        {p.state && `${p.state} · `}
                        {fmtFt(p.elevationFt)}
                      </span>
                    </Link>
                  </li>
                ))}
                {hike.unmatchedPeaks.map((n) => (
                  <li key={n} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
                    <span>{n}</span>
                    <Badge variant="outline" className="border-transparent bg-remaining text-remaining-foreground">
                      Unmatched
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            {hike.unmatchedPeaks.length > 0 && (
              <p className="text-xs text-muted-foreground">Unmatched names aren&apos;t credited to any list. Edit the hike and pick the right peak.</p>
            )}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="track-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="track-h" className="text-base font-medium">
                GPS track
              </h2>
              {track && (
                <Link href={`/map?hike=${hike.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary hover:underline">
                  <MapIcon className="size-4" /> Open on the map
                </Link>
              )}
            </div>
            {track ? (
              <>
                <div className="h-64 overflow-hidden rounded-xl ring-1 ring-foreground/10 md:h-72">
                  <HikeMapLoader geojson={track.geojson} styleUrl={process.env.MAP_STYLE_URL?.trim() || null} />
                </div>
                <p className="text-sm text-muted-foreground tnum">
                  {track.lengthMi.toFixed(1)} mi · {track.pointCount.toLocaleString("en-US")} points · from {track.source === "garmin" ? "Garmin" : "an uploaded file"}
                  {trackNetworks.length > 0 && (
                    <>
                      {" · "}covers{" "}
                      {trackNetworks.map((n, i) => (
                        <span key={n.slug}>
                          {i > 0 && ", "}
                          <Link href={`/redlining?network=${n.slug}`} className="font-medium text-foreground hover:underline">
                            {n.miles.toFixed(1)} mi of {n.name}
                          </Link>
                        </span>
                      ))}
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="max-w-xl text-sm text-muted-foreground">
                Add a .gpx or GeoJSON file to see this hike on the map and tick off the trails it followed for everyone who was counted on it.
              </p>
            )}
            <HikeTrackActions hikeId={hike.id} hasTrack={!!track} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="media-h">
            <h2 id="media-h" className="text-base font-medium">
              Photos and videos
            </h2>
            <HikeMedia hikeId={hike.id} items={media.map((m) => ({ id: m.id, kind: m.kind, name: m.original_name, size: m.size, url: `/api/v1/media/${m.id}` }))} />
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="weather-h">
            <h2 id="weather-h" className="text-base font-medium">
              Weather
            </h2>
            {weather ? (
              <>
                <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
                  <table className="w-full text-sm tnum">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Day</th>
                        <th className="px-3 py-2 font-medium">Conditions</th>
                        <th className="px-3 py-2 font-medium">High / low</th>
                        <th className="px-3 py-2 font-medium">Wind / gust</th>
                        <th className="px-3 py-2 font-medium">Precip / snow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {weather.days.map((d) => (
                        <tr key={d.date}>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(d.date)}</td>
                          <td className="px-3 py-2">{d.summary || "\u2014"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {d.tMaxF != null ? `${Math.round(d.tMaxF)}\u00b0` : "\u2014"} / {d.tMinF != null ? `${Math.round(d.tMinF)}\u00b0` : "\u2014"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {d.windMaxMph != null ? Math.round(d.windMaxMph) : "\u2014"} / {d.gustMaxMph != null ? Math.round(d.gustMaxMph) : "\u2014"} mph
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {d.precipIn ?? "\u2014"} / {d.snowIn ?? "\u2014"} in
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Modeled for {weather.location.label}
                  {weather.location.elevationFt ? ` at ${weather.location.elevationFt.toLocaleString("en-US")} ft` : ""}, so summit wind is usually stronger than shown. Data by{" "}
                  <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    Open-Meteo
                  </a>
                  .
                </p>
              </>
            ) : (
              <p className="max-w-xl text-sm text-muted-foreground">Pull the day&apos;s temperature, wind and snowfall for this hike from Open-Meteo, using the highest peak on it.</p>
            )}
            <HikeWeatherActions hikeId={hike.id} hasWeather={!!weather} />
          </section>

          {(hike.weather || hike.trailConditions || hike.notes) && (
            <section className="flex flex-col gap-4" aria-labelledby="notes-h">
              <h2 id="notes-h" className="text-base font-medium">
                Notes
              </h2>
              <dl className="flex max-w-2xl flex-col gap-4">
                <Fact label="Weather">{hike.weather}</Fact>
                <Fact label="Trail conditions">{hike.trailConditions}</Fact>
                {hike.notes && (
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs text-muted-foreground">Notes</dt>
                    <dd className="text-sm leading-relaxed whitespace-pre-wrap">{hike.notes}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-8">
          <section className="flex flex-col gap-2" aria-labelledby="who-h">
            <h2 id="who-h" className="text-base font-medium">
              Who was there
            </h2>
            <ul className="flex flex-wrap gap-2">
              {hike.participants.map((p) => (
                <li key={p.id}>
                  <Badge variant={p.counts ? "secondary" : "outline"} className="h-7 px-3 text-sm">
                    {p.name}
                    {!p.counts && <span className="text-muted-foreground">(not counted)</span>}
                  </Badge>
                </li>
              ))}
              {hike.participants.length === 0 && <li className="text-sm text-muted-foreground">Nobody recorded.</li>}
            </ul>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="stats-h">
            <h2 id="stats-h" className="text-base font-medium">
              Details
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Fact label="Distance">{hike.distanceMi != null && `${hike.distanceMi} mi`}</Fact>
              <Fact label="Elevation gain">{hike.elevationGainFt != null && `${hike.elevationGainFt.toLocaleString("en-US")} ft`}</Fact>
              <Fact label="Duration">{fmtDuration(hike.durationMin)}</Fact>
              <Fact label="Route">{hike.routeType?.replace("_", " ")}</Fact>
              <Fact label="Other lists">{hike.otherLists}</Fact>
              <Fact label="Source">{hike.source}</Fact>
            </dl>
          </section>

          {lists.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="credit-h">
              <h2 id="credit-h" className="text-base font-medium">
                Counts toward
              </h2>
              <ul className="flex flex-col gap-1">
                {lists.map((l) => (
                  <li key={l.slug}>
                    <Link href={`/lists/${l.slug}`} className="flex min-h-9 items-center justify-between gap-3 text-sm hover:underline">
                      <span>{l.name}</span>
                      <span className="text-muted-foreground tnum">
                        {l.n} {l.n === 1 ? "peak" : "peaks"}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
