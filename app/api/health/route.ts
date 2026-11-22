import { db } from "@/lib/db"
import pkg from "@/package.json"

export const dynamic = "force-dynamic"

export function GET() {
  try {
    db().prepare("SELECT 1").get()
    return Response.json({ ok: true, version: pkg.version })
  } catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
