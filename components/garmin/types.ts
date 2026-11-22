export type GarminStatus = {
  connected: boolean
  keyExpiresAt?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
  pendingCount?: number
}

export type Suggestion = {
  id: number
  name: string
  elevationFt: number | null
  state: string | null
  reason: "track" | "title"
  detail: string
}

export type GarminActivityView = {
  id: number
  startDate: string
  name: string | null
  type: string | null
  distanceMi: number | null
  elevationGainFt: number | null
  durationMin: number | null
  status: "pending" | "imported" | "ignored"
  suggestedPeaks: Suggestion[]
}
