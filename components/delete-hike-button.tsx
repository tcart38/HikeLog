"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/client/api"

export function DeleteHikeButton({ id, label }: { id: number; label: string }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  async function del() {
    setPending(true)
    try {
      await api(`/api/v1/hikes/${id}`, { method: "DELETE" })
      toast.success("Hike deleted")
      router.replace("/hikes")
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete the hike")
      setPending(false)
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" className="h-10 md:h-8" />}>
        <Trash2Icon /> Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this hike?</AlertDialogTitle>
          <AlertDialogDescription>
            {label} will be removed, and every list it counted toward will update. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <Button variant="destructive" onClick={del} disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />} Delete hike
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
