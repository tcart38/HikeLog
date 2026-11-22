import { z } from "zod"
import { createApiToken, listApiTokens } from "@/lib/auth"
import { json, readJson, withAuth } from "@/lib/api"

const schema = z.object({ name: z.string().trim().min(1).max(80) })

export const GET = withAuth(async (_req, { user }) => json({ tokens: listApiTokens(user.id) }))

export const POST = withAuth(async (req, { user }) => {
  const { name } = schema.parse(await readJson(req))
  const t = createApiToken(user.id, name)
  return json({ token: t.token, id: t.id, prefix: t.prefix, name }, 201)
})
