import { cookies } from "next/headers"
import { SESSION_COOKIE, deleteSession } from "@/lib/auth"
import { handle, json } from "@/lib/api"

export const POST = handle(async () => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) deleteSession(token)
  jar.delete(SESSION_COOKIE)
  return json({ ok: true })
})
