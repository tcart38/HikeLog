import { json, readJson, withAuth } from "@/lib/api"
import { createPerson, listPeople } from "@/lib/people"

export const GET = withAuth(async () => json({ people: listPeople() }))

export const POST = withAuth(async (req, { user }) => json({ person: createPerson(await readJson(req), user.id) }, 201))
