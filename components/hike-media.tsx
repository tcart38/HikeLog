"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ImagePlusIcon, Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { api } from "@/lib/client/api"

export type MediaItem = { id: number; kind: "image" | "video"; name: string | null; size: number; url: string }

function sendFile(hikeId: number, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/v1/hikes/${hikeId}/media`)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onerror = () => reject(new Error("Can't reach the server"))
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      let msg = `Upload failed (${xhr.status})`
      try {
        msg = JSON.parse(xhr.responseText).error ?? msg
      } catch {}
      reject(new Error(msg))
    }
    xhr.send(file)
  })
}

/** Photos and videos on a hike: upload (phone camera roll or desktop), view full size, remove. */
export function HikeMedia({ hikeId, items }: { hikeId: number; items: MediaItem[] }) {
  const router = useRouter()
  const input = React.useRef<HTMLInputElement>(null)
  const [status, setStatus] = React.useState<string | null>(null)
  const [viewing, setViewing] = React.useState<MediaItem | null>(null)

  async function upload(files: FileList) {
    const list = [...files]
    let done = 0
    for (const f of list) {
      try {
        await sendFile(hikeId, f, (p) => setStatus(`Uploading ${done + 1} of ${list.length}: ${Math.round(p * 100)}%`))
        done++
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : "upload failed"}`)
      }
    }
    setStatus(null)
    if (input.current) input.current.value = ""
    if (done) {
      toast.success(done === 1 ? "Added to this hike" : `Added ${done} files`)
      router.refresh()
    }
  }

  async function remove(m: MediaItem) {
    if (!window.confirm(`Remove ${m.name ?? "this file"} from the hike?`)) return
    try {
      await api(`/api/v1/media/${m.id}`, { method: "DELETE" })
      setViewing(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove it")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((m) => (
            <li key={m.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
              <button type="button" onClick={() => setViewing(m)} aria-label={`Open ${m.name ?? (m.kind === "video" ? "video" : "photo")}`} className="absolute inset-0 size-full">
                {m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.name ?? "Hike photo"} loading="lazy" className="size-full object-cover" />
                ) : (
                  <>
                    <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="size-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                      <PlayIcon className="size-8 fill-current" />
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,video/*,.heic,.heif"
          className="sr-only"
          aria-label="Photos and videos"
          tabIndex={-1}
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
        <Button variant="outline" className="h-10 md:h-8" disabled={!!status} onClick={() => input.current?.click()}>
          {status ? <Loader2Icon className="animate-spin" /> : <ImagePlusIcon />}
          {status ?? "Add photos or videos"}
        </Button>
      </div>
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-[min(96vw,64rem)] gap-3 sm:max-w-[min(96vw,64rem)]">
          <DialogTitle className="truncate pr-8 text-sm">{viewing?.name ?? "Media"}</DialogTitle>
          <DialogDescription className="sr-only">Full size view</DialogDescription>
          {viewing &&
            (viewing.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.url} alt={viewing.name ?? "Hike photo"} className="max-h-[75vh] w-full rounded-lg object-contain" />
            ) : (
              <video src={viewing.url} controls autoPlay playsInline className="max-h-[75vh] w-full rounded-lg bg-black" />
            ))}
          <div className="flex justify-end">
            {viewing && (
              <Button variant="ghost" className="text-destructive" onClick={() => remove(viewing)}>
                <Trash2Icon /> Remove
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
