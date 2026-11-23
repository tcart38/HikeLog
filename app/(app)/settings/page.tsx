import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { PasswordForm } from "@/components/settings/password-form"
import { Section } from "@/components/settings/section"
import { SignupSetting } from "@/components/settings/signup-setting"
import { UsersPanel } from "@/components/settings/users-panel"
import { listUsers, selfSignupEnabled } from "@/lib/auth"
import { listPeople, requireUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Account" }

export default async function SettingsPage() {
  const user = await requireUser()
  const people = listPeople()
  const me = people.find((p) => p.id === user.person_id)
  const users = listUsers()

  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${me?.name ?? user.username} (@${user.username})${user.is_admin ? ", admin" : ""}`} />
      <div className="flex max-w-3xl flex-col gap-8">
        <Section id="password" title="Password">
          <PasswordForm userId={user.id} />
        </Section>
        {user.is_admin ? (
          <Section id="signup" title="Sign-up" description="Let people create their own account from the sign-in page, or keep it invite-only.">
            <SignupSetting enabled={selfSignupEnabled()} />
          </Section>
        ) : null}
        {user.is_admin ? (
          <Section id="users" title="Accounts" description="Who can sign in to this HikeLog.">
            <UsersPanel
              users={users.map((u) => ({ id: u.id, username: u.username, is_admin: u.is_admin, personName: people.find((p) => p.id === u.person_id)?.name ?? null }))}
              currentId={user.id}
            />
          </Section>
        ) : null}
      </div>
    </>
  )
}
