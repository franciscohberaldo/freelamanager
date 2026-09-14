/**
 * Names arrive shouting. The São Paulo NFS-e prints every name in capitals, and so do most
 * of the documents a job's data gets copied from, which is how "R/GA MEDIA GROUP
 * PUBLICIDADE LTDA." ends up in a table next to "Bamboo | Jimmy Nardello".
 *
 * Quieting them down is not just title-casing: "IPG", "YSFL" and "RGA" are acronyms, and
 * lowercasing those would do more damage than the shouting does. So the rule is narrow —
 * only text of two or more words is touched, and inside it anything that looks like an
 * acronym is left alone.
 */

/** Portuguese particles, which stay lowercase unless they open the name. */
const PARTICLES = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "ao", "aos",
])

/** Legal forms and abbreviations that are written in capitals by convention. */
const KEEP_UPPER = new Set(["me", "epp", "eireli", "mei", "sa"])

/** Text carrying letters, none of them lowercase. */
export function isShouty(value: string): boolean {
  return /\p{L}/u.test(value) && !/\p{Ll}/u.test(value)
}

const lettersOf = (token: string) => token.replace(/[^\p{L}]/gu, "")

function titleCase(token: string): string {
  return token.replace(/\p{L}[\p{L}'’]*/u, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

export function normalizeName<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string" || !isShouty(value)) return value

  // Splitting on the separators rather than dropping them keeps the original spacing,
  // hyphens and punctuation exactly where they were.
  const parts = value.split(/(\s+)/)
  const wordIndexes = parts
    .map((p, i) => (/\p{L}/u.test(p) ? i : -1))
    .filter(i => i !== -1)

  // A lone word is an acronym, not shouting.
  if (wordIndexes.length < 2) return value

  const first = wordIndexes[0]

  return parts.map((token, i) => {
    if (!/\p{L}/u.test(token)) return token

    const letters = lettersOf(token).toLowerCase()
    if (KEEP_UPPER.has(letters)) return token
    if (/[\d/]/.test(token)) return token
    if (i === first) return titleCase(token)
    if (PARTICLES.has(letters)) return token.toLowerCase()
    if (letters.length <= 3) return token
    return titleCase(token)
  }).join("") as T
}
