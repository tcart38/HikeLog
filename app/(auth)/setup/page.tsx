import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth-form"
import { signupOpen, userCount } from "@/lib/auth"
import { getUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Set up HikeLog" }
export const dynamic = "force-dynamic"

export default async function SetupPage() {
  if (await getUser()) redirect("/")
  if (userCount() > 0) redirect(signupOpen() ? "/signup" : "/login")
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Welcome to HikeLog</h1>
        <p className="text-sm text-muted-foreground">Create the admin account to get started. You can add your partner and friends afterwards.</p>
      </div>
      <AuthForm mode="setup" />
    </div>
  )
}
