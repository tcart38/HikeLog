import { ApiError, intParam, json, withAuth } from "@/lib/api"
import { getHike } from "@/lib/hikes"
import { listMedia, publicMedia, saveMedia } from "@/lib/media"

type P = { id: string }

export const GET = withAuth<P>(async (_req, { params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  return json({ media: listMedia(id).map(publicMedia) })
})

/**
 * Add a photo or video to a hike. Either multipart with one or more `file` parts,
 * or a raw body (Content-Type = the file's type, `X-Filename` = its name), which streams straight to disk.
 */
export const POST = withAuth<P>(async (req, { user, params }) => {
  const id = intParam(params.id)
  if (!getHike(id)) throw new ApiError("Hike not found", 404)
  const type = req.headers.get("content-type") ?? ""
  const saved = []
  if (type.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null)
    const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File)
    if (!files.length) throw new ApiError("Send one or more `file` parts", 400)
    for (const f of files) saved.push(await saveMedia(id, user.id, f.stream(), f.name || "upload", f.type))
  } else {
    if (!req.body) throw new ApiError("Empty body", 400)
    let name = "upload"
    try {
      name = decodeURIComponent(req.headers.get("x-filename") ?? "") || name
    } catch {}
    saved.push(await saveMedia(id, user.id, req.body, name, type))
  }
  return json({ media: saved.map(publicMedia) }, 201)
})
