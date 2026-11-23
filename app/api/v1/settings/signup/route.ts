import { z } from "zod"
import { selfSignupEnabled, setSelfSignupEnabled } from "@/lib/auth"
import { json, readJson, withAuth } from "@/lib/api"

const schema = z.object({ enabled: z.boolean() })

export const GET = withAuth(async () => json({ enabled: selfSignupEnabled() }), { admin: true })

export const PUT = withAuth(
  async (req) => {
    const { enabled } = schema.parse(await readJson(req))
    setSelfSignupEnabled(enabled)
    return json({ enabled })
  },
  { admin: true }
)
