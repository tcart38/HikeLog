/**
 * Normalize a peak name for matching: lowercase, ASCII, no punctuation, no
 * leading "Mount"/"Mt". "Mt. Owl's Head" -> "owls head".
 * Pure function, safe on client and server.
 */
export function normalizePeakName(input: string): string {
  let s = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
  s = s.replace(/^(mount|mt|mtn)\s+/, "")
  s = s.replace(/\s+(mountain|mtn|mt)$/, "")
  return s.replace(/\s+/g, " ").trim()
}

/** Split a free-text "Mountain(s)" cell into individual names. */
export function splitPeakNames(input: string): string[] {
  return input
    .split(/\s*(?:,|;|\/|\+|&|\band\b|\n)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}
