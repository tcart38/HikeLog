import { ApiError, intParam, json, withAuth } from "@/lib/api"
import { getHike } from "@/lib/hikes"
import { clearWeather, getWeather, importWeather } from "@/lib/weather"

type P = { id: string }

export const GET = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  const weather = getWeather(id)
  if (!weather) throw new ApiError("No weather imported for this hike. POST to import it.", 404)
  return json({ weather })
})

/** Fetch daily weather from Open-Meteo for the hike's date(s) and its highest peak, and store it on the hike. */
export const POST = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  return json({ weather: await importWeather(id) })
})

export const DELETE = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  clearWeather(id)
  return json({ ok: true })
})
