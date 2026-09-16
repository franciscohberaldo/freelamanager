function parse(values: (string | null)[]): number[] {
  return values
    .map((v) => (v == null ? NaN : parseInt(String(v).replace(/\D/g, ""), 10)))
    .filter((n) => Number.isInteger(n))
}

export function padSeq(n: number): string {
  return String(n).padStart(4, "0")
}

/**
 * Display form of an invoice sequence number. Historical imports carry an "NFP" prefix
 * that says nothing the series code does not — "NFP116" shows as "0116", "0102" stays
 * "0102", a missing sequence falls back to the invoice number as "#7".
 */
export function formatSeqNumber(seqNumber: string | null | undefined, invoiceNumber?: string | null): string {
  if (!seqNumber) return invoiceNumber ? `#${invoiceNumber}` : "—"
  const digits = seqNumber.replace(/\D/g, "")
  return digits ? padSeq(parseInt(digits, 10)) : seqNumber
}

/** Missing ranges between the smallest and largest number. */
export function findGaps(values: (string | null)[]): { from: number; to: number }[] {
  const nums = Array.from(new Set(parse(values))).sort((a, b) => a - b)
  if (nums.length < 2) return []
  const gaps: { from: number; to: number }[] = []
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] > 1) gaps.push({ from: nums[i - 1] + 1, to: nums[i] - 1 })
  }
  return gaps
}

/** Values that occur more than once after numeric normalization ("0089" == "89"). */
export function findDuplicates(values: (string | null)[]): string[] {
  const counts = new Map<number, number>()
  for (const n of parse(values)) counts.set(n, (counts.get(n) ?? 0) + 1)
  return Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([n]) => String(n))
    .sort((a, b) => Number(a) - Number(b))
}
