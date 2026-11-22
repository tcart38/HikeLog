import { json, publicList, withAuth } from "@/lib/api"
import { listLists } from "@/lib/progress"

export const GET = withAuth(async () => json({ lists: listLists().map(publicList) }))
