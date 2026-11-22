import fs from "node:fs"
import { Readable } from "node:stream"

import { ApiError, intParam, json, withAuth } from "@/lib/api"
import { deleteMedia, getMedia, mediaPath } from "@/lib/media"

type P = { id: string }

/** Streams the file, with Range support so videos can seek. */
export const GET = withAuth<P>(async (req, { params }) => {
  const m = getMedia(intParam(params.id))
  if (!m) throw new ApiError("Not found", 404)
  const file = mediaPath(m)
  let size: number
  try {
    size = fs.statSync(file).size
  } catch {
    throw new ApiError("The file is missing from disk", 404)
  }
  const headers: Record<string, string> = {
    "Content-Type": m.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(m.original_name ?? "file")}`,
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "")
  if (range && (range[1] || range[2])) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    })
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...headers, "Content-Length": String(size) } })
})

export const DELETE = withAuth<P>(async (_req, { params }) => {
  if (!deleteMedia(intParam(params.id))) throw new ApiError("Not found", 404)
  return json({ ok: true })
})
