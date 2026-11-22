/**
 * Garmin Personal API configuration. Everything that is NOT verified against Garmin's
 * published docs lives here so it can be fixed in one place (or via env overrides).
 *
 * VERIFIED (developer.garmin.com/gc-developer-program/personal/personal-faq/):
 *  - Token endpoint: POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token
 *    with header `Authorization: ApiKey <key>`. Access tokens last 24 h (or until the key expires); no refresh tokens.
 *  - Key page: https://connect.garmin.com/app/settings/personalApiToken ; expiry 30/90/180/365 days.
 *  - Data is pull-only; activities available as JSON summaries and .FIT files.
 * VERIFIED (github.com/garmin/connect-personal-api-python README): endpoint PATHS (no host) such as
 *  /activitylist-service/activities/search/activities?start=&limit=&startDate=&endDate=,
 *  /activity-service/activity/{id}, /download-service/files/activity/{id} (ZIP bytes).
 *
 * TODO(unverified): the data-API host. The docs never state it; we assume it is the same host as the
 * token endpoint. Override with GARMIN_API_BASE (which may include a path prefix).
 * TODO(unverified): token response JSON shape (we accept access_token / accessToken, expires_in / expires_at, or fall back to
 * the JWT `exp` claim, or 24 h), the activity JSON field names (activityId, activityName, activityType.typeKey,
 * startTimeLocal, distance [m], elevationGain [m], duration [s], startLatitude...), and the GPX export path
 * (/download-service/export/gpx/activity/{id}, from the unofficial Garmin Connect web API; the official route is a FIT ZIP).
 * TODO(unverified): rate limits (not published).
 */
export const TOKEN_URL =
  process.env.GARMIN_TOKEN_URL ||
  "https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token"

export const API_BASE = (process.env.GARMIN_API_BASE || "https://personal.connectapi.garmin.com").replace(/\/+$/, "")

export const PATHS = {
  activities: process.env.GARMIN_ACTIVITIES_PATH || "/activitylist-service/activities/search/activities",
  gpx: process.env.GARMIN_GPX_PATH || "/download-service/export/gpx/activity/{id}",
}

export const KEY_PORTAL_URL = "https://connect.garmin.com/app/settings/personalApiToken"

/** Activity typeKeys imported as hike candidates. Override with GARMIN_ACTIVITY_TYPES=hiking,walking,... */
export const ACTIVITY_TYPES = new Set(
  (process.env.GARMIN_ACTIVITY_TYPES || "hiking,mountaineering,backpacking,snowshoeing")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
)

/** First sync looks back this many days. */
export const INITIAL_SYNC_DAYS = Number(process.env.GARMIN_INITIAL_SYNC_DAYS) || 365

/** A track point within this many metres of a peak summit counts as visiting it. */
export const PEAK_RADIUS_M = Number(process.env.GARMIN_PEAK_RADIUS_M) || 150
/** ...and its elevation must be within this many feet of the peak elevation. */
export const PEAK_ELEV_TOLERANCE_FT = Number(process.env.GARMIN_PEAK_ELEV_TOLERANCE_FT) || 300
