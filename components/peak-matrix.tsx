import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { NeededBadge } from "@/components/season-badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtDate, fmtFt, SEASON_STYLE } from "@/lib/format"
import type { Season } from "@/lib/seasons"
import { cn } from "@/lib/utils"

export type MatrixColumn = { key: string; label: string; tone?: Season }
export type MatrixCellData = { done: boolean; hikeId?: number | null; date?: string | null }
export type MatrixRow = {
  slug: string
  name: string
  elevationFt: number | null
  state: string | null
  rank: number | null
  cells: MatrixCellData[]
  credit: number
  units: number
  elective?: boolean
  note?: string | null
}

const toneText: Record<Season, string> = {
  winter: "text-season-winter",
  spring: "text-season-spring",
  summer: "text-season-summer",
  fall: "text-season-fall",
}

function Mark({ cell, col, peak, size = "md" }: { cell: MatrixCellData; col: MatrixColumn; peak: string; size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-8" : "size-6"
  if (!cell.done)
    return (
      <span className={cn("inline-flex rounded-md border border-dashed border-border", box)}>
        <span className="sr-only">
          {peak}: {col.label} not yet
        </span>
      </span>
    )
  const tone = col.tone ? SEASON_STYLE[col.tone].solid : "bg-done text-done-foreground"
  const inner = (
    <span className={cn("inline-flex items-center justify-center rounded-md", box, tone)}>
      <CheckIcon className={size === "lg" ? "size-4" : "size-3.5"} strokeWidth={3} />
    </span>
  )
  const label = `${peak}: ${col.label}${cell.date ? `, ${fmtDate(cell.date)}` : ""}`
  return cell.hikeId ? (
    <Link href={`/hikes/${cell.hikeId}`} aria-label={label} title={label} className="inline-flex rounded-md outline-none transition-shadow hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </Link>
  ) : (
    <span aria-label={label} title={label} className="inline-flex">
      {inner}
    </span>
  )
}

/**
 * Peaks x columns. Desktop: a dense table (sticky first column when it scrolls).
 * Phone: one card per peak with a touch-sized grid of cells.
 * Single-column modes (All / Winter) show the date instead of a check.
 */
export function PeakMatrix({ columns, rows, emptyLabel }: { columns: MatrixColumn[]; rows: MatrixRow[]; emptyLabel?: string }) {
  const single = columns.length === 1
  const mobileCols = columns.length === 12 ? "grid-cols-6" : columns.length === 4 ? "grid-cols-4" : "grid-cols-3"

  if (!rows.length)
    return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyLabel ?? "Nothing to show."}</p>

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl ring-1 ring-foreground/10 md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 text-right">#</TableHead>
              <TableHead>{columns.length && rows.some((r) => r.note) ? "Trail" : "Peak"}</TableHead>
              <TableHead className="text-right">Elevation</TableHead>
              {columns.map((c) => (
                <TableHead key={c.key} className={cn(single ? "w-48" : "w-9 px-1 text-center", c.tone && toneText[c.tone])}>
                  {c.label}
                </TableHead>
              ))}
              {!single && <TableHead className="w-16 text-right">Done</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.slug} className={cn(r.credit >= r.units && "bg-done/[0.04]")}>
                <TableCell className="text-right text-muted-foreground">{r.rank ?? ""}</TableCell>
                <TableCell>
                  <Link href={`/peaks/${r.slug}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  {r.elective && <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Elective</span>}
                  {r.note ? <span className="ml-2 text-xs text-muted-foreground">{r.note}</span> : r.state && <span className="ml-2 text-xs text-muted-foreground">{r.state}</span>}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">{fmtFt(r.elevationFt)}</TableCell>
                {r.cells.map((cell, i) =>
                  single ? (
                    <TableCell key={i}>
                      {cell.done ? (
                        <span className="inline-flex items-center gap-2">
                          <Mark cell={cell} col={columns[i]} peak={r.name} />
                          {cell.hikeId ? (
                            <Link href={`/hikes/${cell.hikeId}`} className="text-sm hover:underline">
                              {cell.date ? fmtDate(cell.date) : "View hike"}
                            </Link>
                          ) : (
                            cell.date && fmtDate(cell.date)
                          )}
                        </span>
                      ) : (
                        <NeededBadge />
                      )}
                    </TableCell>
                  ) : (
                    <TableCell key={i} className="px-1 text-center">
                      <Mark cell={cell} col={columns[i]} peak={r.name} />
                    </TableCell>
                  )
                )}
                {!single && (
                  <TableCell className="text-right text-muted-foreground">
                    {r.credit}/{r.units}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Phone cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => {
          const complete = r.credit >= r.units
          return (
            <li key={r.slug} className={cn("rounded-xl p-3 ring-1 ring-foreground/10", complete && "bg-done/[0.05]")}>
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/peaks/${r.slug}`} className="min-w-0 truncate text-base font-medium">
                  {r.name}
                  {r.elective && <span className="ml-2 rounded-sm bg-muted px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Elective</span>}
                </Link>
                <span className="shrink-0 text-sm text-muted-foreground">{fmtFt(r.elevationFt)}</span>
              </div>
              {single ? (
                <div className="mt-2 flex items-center">
                  {r.cells[0].done ? (
                    <Link href={r.cells[0].hikeId ? `/hikes/${r.cells[0].hikeId}` : "#"} className="inline-flex min-h-9 items-center gap-2 text-sm">
                      <Mark cell={r.cells[0]} col={columns[0]} peak={r.name} />
                      {r.cells[0].date ? fmtDate(r.cells[0].date) : "Done"}
                    </Link>
                  ) : (
                    <NeededBadge />
                  )}
                </div>
              ) : (
                <>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.credit} of {r.units} {columns.length === 12 ? "months" : columns.length === 4 ? "seasons" : "conditions"}
                  </div>
                  <div className={cn("mt-2 grid gap-1.5", mobileCols)}>
                    {r.cells.map((cell, i) => (
                      <div key={i} className="flex flex-col items-center gap-1 rounded-lg bg-muted/40 py-1.5">
                        <span className={cn("text-[11px] font-medium text-muted-foreground", columns[i].tone && toneText[columns[i].tone!])}>{columns[i].label}</span>
                        <Mark cell={cell} col={columns[i]} peak={r.name} size="lg" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
