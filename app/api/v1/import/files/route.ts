import { ApiError, json, withAuth } from "@/lib/api"
import { importFile } from "@/lib/import/files"

/** multipart/form-data with one or more `file` parts (.gpx or .fit). Each becomes an inbox activity to review. */
export const POST = withAuth(async (req, { user }) => {
  const form = await req.formData().catch(() => null)
  const files = (form?.getAll("file") ?? []).filter((f): f is File => typeof f !== "string")
  if (!files.length) throw new ApiError("Send one or more files in a multipart field named 'file'", 400)
  if (files.length > 50) throw new ApiError("At most 50 files at once", 400)
  const results = []
  for (const f of files) results.push(await importFile(user.id, f.name, Buffer.from(await f.arrayBuffer())))
  return json({ results, added: results.filter((r) => r.status === "added").length }, 201)
})
