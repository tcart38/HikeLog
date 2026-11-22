// MapLibre runs its tile code in a module worker. Bundlers (Turbopack) cannot emit that worker reliably,
// so we serve it from /public and point MapLibre at it with setWorkerUrl(). Runs before dev and build.
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist"
const dest = path.join(process.cwd(), "public", "maplibre-gl-worker.mjs")
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(path.join(dist, "maplibre-gl-worker.mjs"), dest)
