import { normalizePeakName } from "../peaks/normalize"

/** Common multi-peak names used in logs, expanded to individual peaks. Keys are plain text; lookup is normalized. */
const TRAVERSES: Record<string, string[]> = {
  "Franconia Ridge": ["Lafayette", "Lincoln"],
  "Bonds": ["Bond", "West Bond", "Bondcliff"],
  "The Bonds": ["Bond", "West Bond", "Bondcliff"],
  "Presi traverse": ["Madison", "Adams", "Jefferson", "Washington", "Monroe", "Eisenhower", "Pierce"],
  "Presidential Traverse": ["Madison", "Adams", "Jefferson", "Washington", "Monroe", "Eisenhower", "Pierce"],
  "Kinsmans": ["North Kinsman", "South Kinsman"],
  "The Kinsmans": ["North Kinsman", "South Kinsman"],
  "Hancocks": ["Hancock", "South Hancock"],
  "The Hancocks": ["Hancock", "South Hancock"],
  "Tripyramids": ["North Tripyramid", "Middle Tripyramid"],
  "The Tripyramids": ["North Tripyramid", "Middle Tripyramid"],
  "Wildcats": ["Wildcat A", "Wildcat D"],
  "The Wildcats": ["Wildcat A", "Wildcat D"],
  "Carters": ["South Carter", "Middle Carter"],
  "The Carters": ["South Carter", "Middle Carter"],
  "Twins": ["North Twin", "South Twin"],
  "The Twins": ["North Twin", "South Twin"],
  "Osceolas": ["Osceola", "East Osceola"],
}

const INDEX = new Map(Object.entries(TRAVERSES).map(([k, v]) => [normalizePeakName(k), v]))

/** Expand a traverse name to its peaks, or null if it is not a known traverse. */
export function expandTraverse(name: string): string[] | null {
  return INDEX.get(normalizePeakName(name)) ?? null
}
