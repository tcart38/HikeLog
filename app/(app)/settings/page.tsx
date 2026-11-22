import type { Metadata } from "next"
import Link from "next/link"
import { BookOpenIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ImportPanel } from "@/components/settings/import-panel"
import { PasswordForm } from "@/components/settings/password-form"
import { PeoplePanel } from "@/components/settings/people-panel"
import { TokensPanel } from "@/components/settings/tokens-panel"
import { UsersPanel } from "@/components/settings/users-panel"
import { Button } from "@/components/ui/button"
import { listApiTokens, listUsers } from "@/lib/auth"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Settings" }

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex flex-col gap-4 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-h`} className="text-base font-medium">
          {title}
        </h2>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default async function SettingsPage() {
  const user = await requireUser()
  const people = listPeople()
  const me = people.find((p) => p.id === user.person_id)
  const users = listUsers()

  return (
    <>
      <PageHeader
        title="Settings"
        description={`Signed in as ${me?.name ?? user.username} (@${user.username})${user.is_admin ? ", admin" : ""}`}
        actions={
          <Button variant="outline" className="h-10 md:h-8" nativeButton={false} render={<Link href="/docs" />}>
            <BookOpenIcon /> API docs
          </Button>
        }
      />
      <div className="flex max-w-3xl flex-col gap-8">
        <Section id="import" title="Import a spreadsheet" description="Bring in an existing hiking log. You'll see exactly what will be created before anything is saved.">
          <ImportPanel people={people.map((p) => ({ id: p.id, name: p.name }))} defaultPersonId={user.person_id} />
        </Section>
        <Section id="people" title="People" description="Everyone who hikes with you. Merge duplicates, or add friends before they have a login.">
          <PeoplePanel people={people.map((p) => ({ id: p.id, name: p.name, username: p.username, hikes: p.hikes }))} />
        </Section>
        <Section id="tokens" title="API tokens" description="Let scripts and AI agents log hikes as you. See the API docs for the endpoints.">
          <TokensPanel tokens={listApiTokens(user.id).map((t) => ({ ...t }))} />
        </Section>
        {user.is_admin ? (
          <Section id="users" title="Accounts" description="Who can sign in to this HikeLog.">
            <UsersPanel
              users={users.map((u) => ({ id: u.id, username: u.username, is_admin: u.is_admin, personName: people.find((p) => p.id === u.person_id)?.name ?? null }))}
              currentId={user.id}
            />
          </Section>
        ) : null}
        <Section id="password" title="Password">
          <PasswordForm userId={user.id} />
        </Section>
      </div>
    </>
  )
}
