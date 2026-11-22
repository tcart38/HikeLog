import { ApiError, json, withAuth } from "@/lib/api"
import { importLog } from "@/lib/import/xlsx"

const MAX_BYTES = 15 * 1024 * 1024
const truthy = (v: unknown) => typeof v === "string" && ["1", "true", "yes"].includes(v.toLowerCase())

export const POST = withAuth(async (req, { user }) => {
  const url = new URL(req.url)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    throw new ApiError("Expected multipart/form-data with a `file` field", 400)
  }
  const file = form.get("file")
  if (!(file instanceof File)) throw new ApiError("Missing `file` upload", 400)
  if (file.size > MAX_BYTES) throw new ApiError("File too large (max 15 MB)", 413)
  const dryRun = truthy(url.searchParams.get("dryRun")) || truthy(form.get("dryRun"))
  const self = form.get("self")
  const result = await importLog(
    { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) },
    { self: typeof self === "string" ? self : null, defaultPersonId: user.person_id, userId: user.id, dryRun }
  )
  return json(result)
})
