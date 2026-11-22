"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2Icon, FileSpreadsheetIcon, Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api } from "@/lib/client/api"
import { fmtDate } from "@/lib/format"
import { cn } from "@/lib/utils"

type Match =
  | { input: string; status: "matched"; peak: { name: string } }
  | { input: string; status: "ambiguous"; candidates: { name: string; state: string | null }[] }
  | { input: string; status: "unmatched" }
type Row = {
  row: number
  action: "create" | "update" | "skipped"
  date: string | null
  endDate: string | null
  peaks: Match[]
  unmatchedPeaks: string[]
  participants: { name: string; counts: boolean; isNew: boolean }[]
  warnings: string[]
}
type Preview = {
  rows: Row[]
  summary: { rows: number; create: number; update: number; skipped: number; warnings: number; unmatchedPeaks: string[]; newPeople: string[] }
  reconcile?: { sheet: string; sheetOnly: string[]; logOnly: string[] }[]
  created?: number
  updated?: number
}

export function ImportPanel({ people, defaultPersonId }: { people: { id: number; name: string }[]; defaultPersonId: number | null }) {
  const router = useRouter()
  const [file, setFile] = React.useState<File | null>(null)
  const [self, setSelf] = React.useState(String(defaultPersonId ?? people[0]?.id ?? ""))
  const [preview, setPreview] = React.useState<Preview | null>(null)
  const [done, setDone] = React.useState<Preview | null>(null)
  const [busy, setBusy] = React.useState<"preview" | "commit" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  function form() {
    const f = new FormData()
    f.set("file", file!)
    const p = people.find((x) => String(x.id) === self)
    if (p) f.set("self", p.name)
    return f
  }

  async function run(kind: "preview" | "commit") {
    if (!file) return
    setBusy(kind)
    setError(null)
    try {
      const res = await api<Preview>(`/api/v1/import/xlsx${kind === "preview" ? "?dryRun=1" : ""}`, { form: form() })
      if (kind === "preview") {
        setPreview(res)
        setDone(null)
      } else {
        setDone(res)
        setPreview(null)
        setFile(null)
        toast.success(`Imported ${res.created ?? 0} new, ${res.updated ?? 0} updated`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.")
    } finally {
      setBusy(null)
    }
  }

  const peopleItems = people.map((p) => ({ value: String(p.id), label: p.name }))
  const s = preview?.summary

  return (
    <div className="flex flex-col gap-4">
      <div className="grid max-w-xl gap-4">
        <Field>
          <FieldLabel htmlFor="xlsx">Spreadsheet (.xlsx)</FieldLabel>
          <Input
            id="xlsx"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="h-11 py-2 md:h-9"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPreview(null)
              setDone(null)
              setError(null)
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="import-self">Whose log is this?</FieldLabel>
          <Select items={peopleItems} value={self} onValueChange={(v) => setSelf(String(v))}>
            <SelectTrigger id="import-self" className="h-11 w-full sm:w-64 md:h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {peopleItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>They&apos;re added to every imported hike. Partners listed in the sheet are matched by name.</FieldDescription>
        </Field>
        <Button type="button" variant="outline" className="h-11 w-fit md:h-8" disabled={!file || !!busy} onClick={() => run("preview")}>
          {busy === "preview" ? <Loader2Icon className="animate-spin" /> : <UploadIcon />} Preview import
        </Button>
        {error && <FieldError role="alert">{error}</FieldError>}
      </div>

      {done && (
        <Alert>
          <CheckCircle2Icon />
          <AlertTitle>Import finished</AlertTitle>
          <AlertDescription>
            {done.created ?? 0} created, {done.updated ?? 0} updated.{" "}
            <Link href="/hikes" className="font-medium text-primary hover:underline">
              See your hikes
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {preview && s && (
        <div className="flex flex-col gap-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl p-4 ring-1 ring-foreground/10">
            {[
              ["New hikes", s.create],
              ["Updates", s.update],
              ["Skipped", s.skipped],
              ["Warnings", s.warnings],
            ].map(([k, v]) => (
              <div key={k as string} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-xl font-semibold tnum">{v}</dd>
              </div>
            ))}
          </dl>

          {s.unmatchedPeaks.length > 0 && (
            <Alert>
              <TriangleAlertIcon />
              <AlertTitle>{s.unmatchedPeaks.length} peak names didn&apos;t match</AlertTitle>
              <AlertDescription>They&apos;ll be kept as notes on the hike but won&apos;t count toward a list: {s.unmatchedPeaks.join(", ")}.</AlertDescription>
            </Alert>
          )}
          {s.newPeople.length > 0 && (
            <p className="text-sm text-muted-foreground">
              New people will be created: <span className="text-foreground">{s.newPeople.join(", ")}</span>
            </p>
          )}

          <div className="max-h-[32rem] overflow-y-auto rounded-xl ring-1 ring-foreground/10" tabIndex={0} aria-label="Import preview rows">
            <div className="sticky top-0 z-10 hidden grid-cols-[3rem_9rem_1fr_12rem_5rem] gap-3 border-b bg-muted px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
              <span>Row</span>
              <span>Date</span>
              <span>Peaks</span>
              <span>People</span>
              <span>Action</span>
            </div>
            <ul className="divide-y">
              {preview.rows.map((r) => (
                <li key={r.row} className={cn("grid gap-1.5 px-4 py-3 text-sm md:grid-cols-[3rem_9rem_1fr_12rem_5rem] md:gap-3 md:py-2", r.action === "skipped" && "opacity-60")}>
                  <span className="text-muted-foreground tnum">{r.row}</span>
                  <span className="tnum">{r.date ? fmtDate(r.date) : "No date"}</span>
                  <span className="flex flex-wrap gap-1">
                    {r.peaks.map((m, i) =>
                      m.status === "matched" ? (
                        <Badge key={i} variant="secondary">
                          {m.peak.name}
                        </Badge>
                      ) : (
                        <Badge key={i} variant="outline" className="border-transparent bg-remaining text-remaining-foreground">
                          {m.input} {m.status === "ambiguous" ? "(ambiguous)" : "(no match)"}
                        </Badge>
                      )
                    )}
                    {r.peaks.length === 0 && <span className="text-muted-foreground">None</span>}
                    {r.warnings.length > 0 && <span className="w-full text-xs text-remaining-foreground">{r.warnings.join(" · ")}</span>}
                  </span>
                  <span className="text-muted-foreground">{r.participants.map((p) => p.name + (p.isNew ? " (new)" : "")).join(", ")}</span>
                  <span>
                    <Badge variant={r.action === "create" ? "default" : "secondary"} className="capitalize">
                      {r.action}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {preview.reconcile && preview.reconcile.length > 0 && (
            <details className="text-sm">
              <summary className="min-h-9 cursor-pointer font-medium">Checkbox sheets compared with the log ({preview.reconcile.length})</summary>
              <ul className="mt-2 flex flex-col gap-2 text-muted-foreground">
                {preview.reconcile.map((r) => (
                  <li key={r.sheet}>
                    <span className="font-medium text-foreground">{r.sheet}</span>: {r.sheetOnly.length} ticked in the sheet but missing from the log
                    {r.sheetOnly.length > 0 && ` (${r.sheetOnly.slice(0, 6).join(", ")}${r.sheetOnly.length > 6 ? ", …" : ""})`}; {r.logOnly.length} in the log but not ticked.
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" className="h-11 md:h-9" disabled={!!busy || s.create + s.update === 0} onClick={() => run("commit")}>
              {busy === "commit" ? <Loader2Icon className="animate-spin" /> : <FileSpreadsheetIcon />}
              Import {s.create + s.update} {s.create + s.update === 1 ? "hike" : "hikes"}
            </Button>
            <span className="text-sm text-muted-foreground">Re-importing the same sheet updates hikes instead of duplicating them.</span>
          </div>
        </div>
      )}
    </div>
  )
}
