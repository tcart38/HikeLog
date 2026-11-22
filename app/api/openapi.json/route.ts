import { baseUrl, handle } from "@/lib/api"
import { buildOpenApi } from "@/lib/openapi"

export const dynamic = "force-dynamic"

export const GET = handle(async (req) =>
  Response.json(buildOpenApi(baseUrl(req)), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } })
)
