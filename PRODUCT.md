# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
delegated: Next.js 16 + shadcn/ui (owner's preset b6rtA2Hia, base-nova on Base UI) + SQLite, shipped as a Docker image. Installable PWA for phones, full desktop layout for computers.

## Users
Peakbaggers in the Northeast and beyond, starting with the owner (Alex) and his wife (Sam), who hike together, sometimes with friends, and are finishing the NH 48 in winter. They log a hike right after getting down (often on a phone at the trailhead), and plan the next one at a desk (which peaks are left, which peaks both still need, which ones fit together). (Inferred from the owner's brief and spreadsheet.)

## Product Purpose
Replace a hand-maintained spreadsheet (a hike log plus checkbox sheets per list: Winter 48, Season Grid, Snow/No Snow, NE 67) with one log that derives every list's progress automatically: all-season, winter, four-season, 12-month grid, and snow conditions, for every person.

## Positioning
Log a hike once; every list it touches updates for everyone who was there. Comparison between people is first-class ("what do we both still need?"). Self-hosted, with an API so an agent can add hikes.

## Operating Context
- Mobile, post-hike, cold hands, possibly weak signal: logging must be fast, with large touch targets.
- Desktop planning sessions: dense tables, grids (peaks × months), filters, side-by-side comparisons.
- Peak names are typed the way hikers say them ("Owl's Head", "Wildcat A", "the Bonds").

## Capabilities and Constraints
- Lists seeded with sources; peaks shared across lists.
- Winter means astronomical winter (solstice to equinox), per AMC/46er/3500 club rules.
- Must work behind a custom domain (e.g. hike.example.com) and reverse proxies.
- Spreadsheet import of the owner's existing log.

## Brand Commitments
shadcn preset b6rtA2Hia is the binding design system (olive neutrals, green primary, Inter). Name: HikeLog.

## Evidence on Hand
The owner's spreadsheet (~/Downloads/New Hiking Log.xlsx): ~60 logged hikes 2020–2026, partners, weather and trail-condition notes. No testimonials, users or metrics exist; do not invent them.

## Product Principles
1. Log once, credit everywhere.
2. Show what's left before what's done.
3. Compare people honestly: overlap and gaps side by side.
4. Fast on a phone, dense on a desktop.
5. The data is the user's: exportable, API-accessible, self-hosted.
