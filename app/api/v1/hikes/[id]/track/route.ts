import { ApiError, intParam, json, withAuth } from "@/lib/api"
import { getHike } from "@/lib/hikes"
import { MAX_TRACK_BYTES, deleteTrack, getTrack, parseTrackText, saveTrack } from "@/lib/tracks"

type P = { id: string }

export const GET = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  const track = getTrack(id)
  if (!track) throw new ApiError("This hike has no GPS track", 404)
  return json({ track })
})

/** Multipart `file` (.gpx or GeoJSON), or a raw GPX / GeoJSON body. Replaces any existing track. */
export const POST = withAuth<P>(async (req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  const type = req.headers.get("content-type") ?? ""
  let text: string
  let name = ""
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) throw new ApiError("Missing `file` upload (a .gpx or GeoJSON file)", 400)
    if (file.size > MAX_TRACK_BYTES) throw new ApiError("File too large (max 25 MB)", 413)
    text = await file.text()
    name = file.name
  } else {
    text = await req.text()
    if (text.length > MAX_TRACK_BYTES) throw new ApiError("Body too large (max 25 MB)", 413)
  }
  const track = saveTrack(id, parseTrackText(text, name), "gpx")
  return json({ track }, 201)
})

export const DELETE = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  if (!deleteTrack(id)) throw new ApiError("This hike has no GPS track", 404)
  return json({ ok: true })
})
