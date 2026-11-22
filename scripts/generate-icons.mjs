// Generates the PNG icons in public/icons from app/icon.svg. Run: node scripts/generate-icons.mjs
// Uses sharp, which ships as a dependency of next (resolved through next so pnpm's layout is no problem).
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const root = process.cwd()
const sharp = createRequire(createRequire(import.meta.url).resolve("next/package.json"))("sharp")
const out = path.join(root, "public", "icons")
fs.mkdirSync(out, { recursive: true })

const GREEN = "#15803d"
const art = `<path d="M8 50 26 20l9 14 6-9 15 25z" fill="#f0fdf4"/><path d="m26 20 5 8h-5l-3 3z" fill="#bbf7d0"/>`
// Rounded "any" icon: the app icon itself.
const rounded = fs.readFileSync(path.join(root, "app", "icon.svg"))
// Full-bleed square (iOS and Android apply their own mask). Artwork scaled into the safe zone.
const square = (scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${GREEN}"/><g transform="translate(32 32) scale(${scale}) translate(-32 -35)">${art}</g></svg>`
  )

const jobs = [
  ["icon-192.png", rounded, 192],
  ["icon-512.png", rounded, 512],
  ["icon-maskable-512.png", square(0.7), 512], // content within the inner 80% safe circle
  ["apple-touch-icon.png", square(0.9), 180],
]
for (const [name, svg, size] of jobs) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(path.join(out, name))
  console.log("wrote public/icons/" + name)
}
