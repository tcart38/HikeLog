import { InfoIcon, TriangleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { SourceMeta } from "@/lib/import/meta"

/** Plain-language summary plus the honest trade-offs of a source. */
export function Caveats({ source }: { source: SourceMeta }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <p className="text-sm text-muted-foreground">{source.summary}</p>
      <Alert variant={source.official ? "default" : "destructive"}>
        {source.official ? <InfoIcon /> : <TriangleAlertIcon />}
        <AlertTitle>{source.official ? "Good to know" : "Read this first: unofficial route"}</AlertTitle>
        <AlertDescription>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {source.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )
}
