import { redirect } from "next/navigation"

export default function GarminRedirect() {
  redirect("/settings/import?source=garmin")
}
