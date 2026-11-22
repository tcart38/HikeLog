import { publicList, ApiError, json, withAuth } from "@/lib/api"
import { getList, listPeaks } from "@/lib/progress"

export const GET = withAuth<{ slug: string }>(async (_req, { params }) => {
  const list = getList(params.slug)
  if (!list) throw new ApiError("List not found", 404)
  return json({ list: publicList(list), peaks: listPeaks(list.id) })
})
