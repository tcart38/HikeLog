import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth-form"
import { selfSignupEnabled, userCount } from "@/lib/auth"
import { getUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Sign in" }
export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (await getUser()) redirect("/")
  if (userCount() === 0) redirect("/setup")
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Pick up where you left off.</p>
      </div>
      <AuthForm mode="login" />
      {selfSignupEnabled() && (
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            Create account
          </Link>
        </p>
      )}
    </div>
  )
}
