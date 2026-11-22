import { ApiError, json, requirePerson, withAuth } from "@/lib/api"
import { listMapTracks } from "@/lib/tracks"

/** Simplified GPS tracks for the map. ?person= limits to hikes that person was on; ?hike= to one hike. */
export const GET = withAuth(async (req) => {
  const sp = new URL(req.url).searchParams
  const person = sp.get("person")
  const hike = sp.get("hike")
  if (hike && !/^\d+$/.test(hike)) throw new ApiError("Invalid hike", 400)
  const tracks = listMapTracks({ personId: person ? requirePerson(person).id : undefined, hikeId: hike ? Number(hike) : undefined })
  return json({ tracks })
})
