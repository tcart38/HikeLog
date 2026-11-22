import { ApiError, intParam, json, withAuth } from "@/lib/api"
import { deleteApiToken, listApiTokens } from "@/lib/auth"

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
  const id = intParam(params.id)
  if (!listApiTokens(user.id).some((t) => t.id === id)) throw new ApiError("Token not found", 404)
  deleteApiToken(user.id, id)
  return json({ ok: true })
})
