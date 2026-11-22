import fs from "node:fs"
import { Readable } from "node:stream"

import { ApiError, withAuth } from "@/lib/api"
import { ascentsCsv, databaseSnapshot, fullExport, hikesCsv } from "@/lib/export"

const stamp = () => new Date().toISOString().slice(0, 10)

/**
 * Download your data. `?format=` is one of: `json` (everything, default), `hikes.csv`, `ascents.csv`,
 * or `database` (the raw SQLite file, admins only: a full backup, minus the media folder).
 */
export const GET = withAuth(async (req, { user }) => {
  const format = new URL(req.url).searchParams.get("format") ?? "json"
  const file = (name: string, type: string, body: BodyInit) =>
    new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } })
  switch (format) {
    case "json":
      return file(`hikelog-${stamp()}.json`, "application/json", JSON.stringify(fullExport(), null, 2))
    case "hikes.csv":
      return file(`hikelog-hikes-${stamp()}.csv`, "text/csv; charset=utf-8", hikesCsv())
    case "ascents.csv":
      return file(`hikelog-ascents-${stamp()}.csv`, "text/csv; charset=utf-8", ascentsCsv())
    case "database": {
      if (!user.is_admin) throw new ApiError("Only admins can download the database", 403)
      const snap = databaseSnapshot()
      const stream = fs.createReadStream(snap)
      stream.on("close", () => fs.rmSync(snap.replace(/[^/]+$/, ""), { recursive: true, force: true }))
      return file(`hikelog-${stamp()}.db`, "application/vnd.sqlite3", Readable.toWeb(stream) as ReadableStream)
    }
    default:
      throw new ApiError("format must be json, hikes.csv, ascents.csv or database", 400)
  }
})
