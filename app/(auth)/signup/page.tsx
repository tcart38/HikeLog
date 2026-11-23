import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AuthForm } from "@/components/auth-form"
import { selfSignupEnabled, userCount } from "@/lib/auth"
import { getUser } from "@/lib/queries"

export const metadata: Metadata = { title: "Create account" }
export const dynamic = "force-dynamic"

export default async function SignupPage() {
  if (await getUser()) redirect("/")
  if (userCount() === 0) redirect("/setup")
  if (!selfSignupEnabled()) redirect("/login")
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Start your own hike log. You can change your name later.</p>
      </div>
      <AuthForm mode="signup" />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
