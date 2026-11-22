import "server-only"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { all, get, run } from "./db"
import { dataDir } from "./db"
import { HikeError } from "./hikes"

export type MediaRow = {
  id: number
  hike_id: number
  kind: "image" | "video"
  file: string
  original_name: string | null
  mime: string
  size: number
  caption: string | null
  created_by: number | null
  created_at: string
}

/** Photos and videos only. SVG is excluded on purpose (it can carry script). */
const TYPES: Record<string, { mime: string; kind: "image" | "video" }> = {
  ".jpg": { mime: "image/jpeg", kind: "image" },
  ".jpeg": { mime: "image/jpeg", kind: "image" },
  ".png": { mime: "image/png", kind: "image" },
  ".webp": { mime: "image/webp", kind: "image" },
  ".gif": { mime: "image/gif", kind: "image" },
  ".avif": { mime: "image/avif", kind: "image" },
  ".heic": { mime: "image/heic", kind: "image" },
  ".heif": { mime: "image/heif", kind: "image" },
  ".mp4": { mime: "video/mp4", kind: "video" },
  ".m4v": { mime: "video/mp4", kind: "video" },
  ".mov": { mime: "video/quicktime", kind: "video" },
  ".webm": { mime: "video/webm", kind: "video" },
}
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif",
  "image/heic": ".heic", "image/heif": ".heif", "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
}

export const MAX_IMAGE_BYTES = 60 * 1024 * 1024
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024

export const mediaRoot = () => path.join(dataDir(), "media")

/** Work out the type from the file name, falling back to the declared content type. */
export function classify(name: string, declared: string | null): { ext: string; mime: string; kind: "image" | "video" } {
  const ext = path.extname(name).toLowerCase()
  const byExt = TYPES[ext]
  if (byExt) return { ext, ...byExt }
  const mime = (declared ?? "").split(";")[0].trim().toLowerCase()
  if (MIME_EXT[mime]) return { ext: MIME_EXT[mime], mime, kind: mime.startsWith("video/") ? "video" : "image" }
  throw new HikeError("Only photos (JPEG, PNG, WebP, HEIC, GIF, AVIF) and videos (MP4, MOV, WebM) can be uploaded", undefined, 415)
}

export function listMedia(hikeId: number): MediaRow[] {
  return all<MediaRow>("SELECT * FROM hike_media WHERE hike_id = ? ORDER BY created_at, id", hikeId).map((r) => ({ ...r }))
}
export function getMedia(id: number): MediaRow | undefined {
  return get<MediaRow>("SELECT * FROM hike_media WHERE id = ?", id)
}

/** Stream an upload to disk (never held in memory) and record it. Rejects anything over the size cap. */
export async function saveMedia(
  hikeId: number,
  userId: number | null,
  source: ReadableStream<Uint8Array>,
  originalName: string,
  declaredType: string | null
): Promise<MediaRow> {
  const t = classify(originalName, declaredType)
  const limit = t.kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
  const rel = path.join(String(hikeId), `${crypto.randomUUID()}${t.ext}`)
  const abs = path.join(mediaRoot(), rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  let size = 0
  const cap = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      size += chunk.length
      if (size > limit) cb(new HikeError(`File too large (max ${Math.round(limit / 1048576)} MB for ${t.kind === "video" ? "videos" : "photos"})`, undefined, 413))
      else cb(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(source as never), cap, fs.createWriteStream(abs))
  } catch (e) {
    fs.rmSync(abs, { force: true })
    if (e instanceof HikeError) throw e
    throw new HikeError("Upload was interrupted. Try again.", undefined, 400)
  }
  if (size === 0) {
    fs.rmSync(abs, { force: true })
    throw new HikeError("The file is empty", undefined, 400)
  }
  const id = Number(
    run(
      "INSERT INTO hike_media (hike_id, kind, file, original_name, mime, size, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      hikeId, t.kind, rel.split(path.sep).join("/"), originalName.slice(0, 200), t.mime, size, userId
    ).lastInsertRowid
  )
  return getMedia(id)!
}

export function mediaPath(m: Pick<MediaRow, "file">): string {
  const abs = path.resolve(mediaRoot(), m.file)
  if (!abs.startsWith(path.resolve(mediaRoot()) + path.sep)) throw new HikeError("Bad media path", undefined, 400)
  return abs
}

export function deleteMedia(id: number): boolean {
  const m = getMedia(id)
  if (!m) return false
  run("DELETE FROM hike_media WHERE id = ?", id)
  fs.rmSync(mediaPath(m), { force: true })
  return true
}

/** Remove a hike's files from disk. Call before deleting the hike row (the rows cascade). */
export function purgeHikeMedia(hikeId: number) {
  for (const m of listMedia(hikeId)) fs.rmSync(mediaPath(m), { force: true })
  fs.rmSync(path.join(mediaRoot(), String(hikeId)), { recursive: true, force: true })
}

export function publicMedia(m: MediaRow) {
  return { id: m.id, hikeId: m.hike_id, kind: m.kind, name: m.original_name, mime: m.mime, size: m.size, caption: m.caption, createdAt: m.created_at, url: `/api/v1/media/${m.id}` }
}

