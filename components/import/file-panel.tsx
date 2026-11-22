"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, UploadIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"
import { cn } from "@/lib/utils"

type Result = { name: string; status: "added" | "duplicate" | "error"; message?: string }

export function FilePanel() {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [dragging, setDragging] = React.useState(false)
  const [results, setResults] = React.useState<Result[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => /\.(gpx|fit)$/i.test(f.name))
    if (!list.length) {
      toast.error("Use .gpx or .fit files.")
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      for (const f of list) form.append("file", f)
      const r = await api<{ results: Result[]; added: number }>("/api/v1/import/files", { form })
      setResults(r.results)
      toast.success(r.added ? `${r.added} ${r.added === 1 ? "file" : "files"} ready to review` : "Nothing new in those files")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <input ref={inputRef} type="file" accept=".gpx,.fit" multiple className="sr-only" aria-label="GPX or FIT files" onChange={(e) => e.target.files && void upload(e.target.files).then(() => (e.target.value = ""))} />
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
          setDragging(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void upload(e.dataTransfer.files)
        }}
        className={cn(
          "flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-card px-4 py-6 text-center text-sm transition-colors",
          "hover:border-primary/50 hover:bg-muted/50 active:bg-muted",
          dragging && "border-primary bg-primary/5"
        )}
      >
        {busy ? <Loader2Icon className="size-6 animate-spin text-muted-foreground" /> : <UploadIcon className="size-6 text-muted-foreground" />}
        <p className="font-medium">Drop .gpx or .fit files here</p>
        <Button type="button" variant="outline" className="h-11 md:h-8" disabled={busy}>
          Browse files
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {results.map((r, i) => (
            <li key={i} className={r.status === "error" ? "text-destructive" : "text-muted-foreground"}>
              {r.name}: {r.status === "added" ? "added to review" : r.status === "duplicate" ? "already imported" : r.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
