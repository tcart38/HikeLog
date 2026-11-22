/** Client-safe description of every import source, shown in Settings and the API docs. */
export type SourceId = "garmin" | "garmin_connect" | "strava" | "file"

export type SourceMeta = {
  id: SourceId
  label: string
  short: string
  official: boolean
  /** What the person needs to do. */
  summary: string
  /** Candid trade-offs, shown in the UI. */
  caveats: string[]
}

export const SOURCES: SourceMeta[] = [
  {
    id: "garmin",
    label: "Garmin Personal API",
    short: "Garmin (official)",
    official: true,
    summary: "Garmin's own personal API key. Read-only, no password shared, but the key has to be requested and renewed.",
    caveats: ["Keys expire (30 days to a year) and Garmin rate-limits them, so a 429 means wait before retrying."],
  },
  {
    id: "garmin_connect",
    label: "Garmin Connect login",
    short: "Garmin (login)",
    official: false,
    summary: "Signs in to Garmin Connect with your email and password through the open-source python-garminconnect library. No developer key needed.",
    caveats: [
      "Unofficial: it imitates Garmin's mobile app. That is outside Garmin's Terms of Service, so Garmin could block or break it at any time. This has happened before.",
      "Your password is sent to Garmin once and then discarded. Only the session tokens are kept, encrypted on this server. Anyone with this server's data volume and APP_SECRET could use them.",
      "Garmin rate-limits logins. Don't retry in a loop. Accounts with MFA are supported, you'll be asked for the code.",
    ],
  },
  {
    id: "strava",
    label: "Strava",
    short: "Strava",
    official: true,
    summary: "Strava's official API. You create a free personal app at strava.com/settings/api and authorise HikeLog once.",
    caveats: [
      "Official and allowed, but each person creates their own API app (free). New apps are capped at one connected athlete until Strava approves them, which is fine for personal use.",
      "Default limits are 100 requests per 15 minutes and 1,000 per day, so a big first import takes a few Sync clicks.",
      "Strava's terms restrict how API data may be shown to others. Here it only goes into your own private log.",
      "There is no 'reverse-engineered' Strava option here on purpose: those tools scrape the website with your login cookies, break often, and risk your account. The official API is free, so there is little reason to.",
    ],
  },
  {
    id: "file",
    label: "GPX / FIT files",
    short: "Files",
    official: true,
    summary: "Upload .gpx or .fit files exported from any app or watch. No account, nothing leaves this server.",
    caveats: ["Fully manual: export from Garmin Connect, Strava, Gaia, AllTrails, COROS and so on, then drop the files here."],
  },
]

export const sourceLabel = (id: string) => SOURCES.find((s) => s.id === id)?.short ?? id
