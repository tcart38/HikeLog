import { db } from "@/lib/db"
import { APP_VERSION } from "@/lib/version"

export const dynamic = "force-dynamic"

export function GET() {
  try {
    db().prepare("SELECT 1").get()
    return Response.json({ ok: true, version: APP_VERSION })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
