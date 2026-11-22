import { json, withAuth } from "@/lib/api"
import { getPerson } from "@/lib/people"

export const GET = withAuth(async (_req, { user }) =>
  json({ user, person: user.person_id ? getPerson(user.person_id) : null })
)
