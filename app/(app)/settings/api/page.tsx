import type { Metadata } from "next"
import { ExternalLinkIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Section } from "@/components/settings/section"
import { TokensPanel } from "@/components/settings/tokens-panel"
import { Button } from "@/components/ui/button"
import { listApiTokens } from "@/lib/auth"
import { requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "API & tokens" }

export default async function SettingsApiPage() {
  const user = await requireUser()
  return (
    <>
      <PageHeader
        title="API & tokens"
        description="Everything the app does is available to scripts and AI agents."
        actions={
          <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<a href="/docs" target="_blank" rel="noreferrer" />}>
            <ExternalLinkIcon /> Open full page
          </Button>
        }
      />
      <Section id="tokens" title="API tokens" description="Create a token, then send it as a Bearer token. Tokens act as you.">
        <div className="max-w-3xl">
          <TokensPanel tokens={listApiTokens(user.id).map((t) => ({ ...t }))} />
        </div>
      </Section>
      <Section id="docs" title="API documentation">
        <iframe src="/docs" title="HikeLog API documentation" className="h-[75vh] min-h-96 w-full rounded-xl border bg-white" />
      </Section>
    </>
  )
}
