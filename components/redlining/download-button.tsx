"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { DownloadIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"

type Result = { results: { name: string; trails: number; segments: number; totalMi: number; seconds: number; coverage: { hikes: number } }[] }

/** Admin action: pull a network's geometry from OpenStreetMap (Overpass). Can take a minute or more. */
export function DownloadNetworkButton({ slug, name, redownload = false, size = "default" }: { slug: string; name: string; redownload?: boolean; size?: "default" | "sm" }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const run = async () => {
    setBusy(true)
    const t = toast.loading(`Downloading ${name} from OpenStreetMap. This can take a few minutes.`)
    try {
      const r = await api<Result>(`/api/v1/networks/${slug}/download`, { method: "POST" })
      const total = r.results.reduce((a, x) => a + x.totalMi, 0)
      toast.success(`${name}: ${r.results.reduce((a, x) => a + x.trails, 0)} trails, ${total.toLocaleString("en-US", { maximumFractionDigits: 1 })} mi`, { id: t })
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", { id: t })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant={redownload ? "outline" : "default"} size={size === "sm" ? "sm" : "default"} onClick={run} disabled={busy} className={size === "default" ? "h-10 md:h-8" : undefined}>
      {busy ? <Loader2Icon className="animate-spin" /> : redownload ? <RefreshCwIcon /> : <DownloadIcon />}
      {busy ? "Downloading" : redownload ? "Refresh" : "Download network"}
    </Button>
  )
}
