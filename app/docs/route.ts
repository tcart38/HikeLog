import { APP_VERSION } from "@/lib/version"

export const dynamic = "force-static"

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HikeLog API v${APP_VERSION}</title>
  <style>
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
    .qs { padding: 12px 20px; background: #f4f5ef; border-bottom: 1px solid #d9dccf; color: #222; font-size: 14px; }
    .qs summary { cursor: pointer; font-weight: 600; }
    .qs pre { background: #1f2418; color: #e8ecdc; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12.5px; }
    .qs code { font-family: ui-monospace, monospace; }
  </style>
</head>
<body>
  <details class="qs" open>
    <summary>Quick start for agents (HikeLog v${APP_VERSION}, pre-1.0)</summary>
    <p>Create an API token in Settings, then log a hike with peak and partner <em>names</em>. Add <code>externalId</code> to make it idempotent.</p>
    <pre><code>curl -X POST "$BASE_URL/api/v1/hikes" \\
  -H "Authorization: Bearer hk_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"date":"2026-01-17","peaks":["Lafayette","Lincoln"],"participants":["Sam"],"conditions":"snow","externalId":"franconia-2026-01-17"}'

curl -H "Authorization: Bearer hk_YOUR_TOKEN" "$BASE_URL/api/v1/progress?mode=winter"</code></pre>
    <p>Machine-readable spec: <a href="/api/openapi.json">/api/openapi.json</a></p>
  </details>
  <script id="api-reference" data-url="/api/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`

export function GET() {
  return new Response(HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
}
