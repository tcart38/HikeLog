import { db } from "../lib/db"
import { matchPeaks } from "../lib/peaks/match"
import { seasonStarts, seasonOf } from "../lib/seasons"
db()
for (const y of [2024, 2025, 2026]) console.log(y, seasonStarts(y))
console.log(seasonOf("2023-12-09"), seasonOf("2025-12-28"), seasonOf("2026-03-15"), seasonOf("2024-03-31"))
const names = "Washington, Wildcat A, Owl's Head, Owls Head, Bigelow, Avery Peak, West Peak, Baxter Peak, Mount Abraham, Franconia ridge, Celar, Saddleback Horn, Pierce, Tom, Field, Willey, Crocker Mountain, Mount Redington, North Brother, South Brother, Hamlin Peak, Killington Peak, Camel's Hump, Mount Ellen, Spaulding Mountain, Sugarloaf, Old Speck, Mount Mansfield, Cabot, Isolation"
for (const r of matchPeaks(names)) console.log(r.input, "=>", r.status, r.status === "matched" ? r.peak.slug + " " + r.via : r.status === "ambiguous" ? r.candidates.map(c=>c.slug).join("|") : r.suggestions.map(c=>c.slug).join("|"))
console.log(db().prepare("select count(*) n from peaks").get(), db().prepare("select slug, (select count(*) from list_peaks where list_id=lists.id) n from lists").all())
