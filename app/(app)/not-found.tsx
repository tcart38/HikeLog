import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-12">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-sm text-muted-foreground">That page or record doesn&apos;t exist, or it was deleted.</p>
      <Button nativeButton={false} render={<Link href="/" />}>Back to dashboard</Button>
    </div>
  )
}
