export type NfStatus = "not_required" | "pending" | "requested" | "issued" | "sent"
export type NfSeries = "paulinia" | "sao_paulo"

export const NF_STATUSES: NfStatus[] = ["not_required", "pending", "requested", "issued", "sent"]

export const NF_STATUS_LABELS: Record<NfStatus, string> = {
  not_required: "Não exigida",
  pending:      "Pendente",
  requested:    "Pedida ao contador",
  issued:       "Emitida",
  sent:         "Enviada ao cliente",
}

export const NF_SERIES_LABELS: Record<NfSeries, string> = {
  paulinia:  "Paulínia (até 2019)",
  sao_paulo: "São Paulo",
}

/** Short code printed after the NF number: "0030 PLN", "0015 SP". */
export const NF_SERIES_CODES: Record<NfSeries, string> = {
  paulinia:  "PLN",
  sao_paulo: "SP",
}

/**
 * The company moved from Paulínia to São Paulo: notes issued before this date belong to
 * the PLN series, notes from this date on belong to SP.
 */
export const NF_SERIES_CUTOFF = "2020-01-01"

/** Series a note belongs to, given its issue date (ISO `yyyy-mm-dd`). */
export function seriesForDate(date: string | null | undefined): NfSeries {
  return date != null && date < NF_SERIES_CUTOFF ? "paulinia" : "sao_paulo"
}

/**
 * The series to display even for rows imported before `nf_series` existed: the stored
 * series wins; when it is null, the issue date (or the invoice's period start) decides —
 * the company was in Paulínia before the cutoff and in São Paulo after it.
 */
export function effectiveNfSeries(
  series: NfSeries | null | undefined,
  date: string | null | undefined,
): NfSeries {
  return series ?? seriesForDate(date)
}

/**
 * Display form of an NF number: digits padded to 4 positions followed by the series
 * code — "0030 PLN" for Paulínia, "0015 SP" for São Paulo. Values without digits are
 * returned as stored; a missing series omits the code. Returns "" without a number.
 */
export function formatNfNumber(series: NfSeries | null | undefined, number: string | null | undefined): string {
  if (!number) return ""
  const digits = number.replace(/\D/g, "")
  const base = digits ? digits.padStart(4, "0") : number.trim()
  return series ? `${base} ${NF_SERIES_CODES[series]}` : base
}

/**
 * Canonical stored form of what the user typed as the NF number: only the digits,
 * padded to 4 — "30", "0030 PLN" and "nfp 30" all become "0030". The series lives in
 * `nf_series`, never in the number. Returns "" when there are no digits at all.
 */
export function normalizeNfNumber(input: string): string {
  const digits = input.replace(/\D/g, "")
  return digits ? digits.padStart(4, "0") : ""
}

const TRANSITIONS: Record<NfStatus, NfStatus[]> = {
  not_required: ["pending"],
  pending:      ["requested", "issued"],
  requested:    ["issued", "pending"],
  issued:       ["sent"],
  sent:         [],
}

/** BRL invoices need an NF from the start; foreign ones only after money arrives. */
export function initialNfStatus(currency: string): NfStatus {
  return currency === "BRL" ? "pending" : "not_required"
}

export function canTransition(from: NfStatus, to: NfStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: NfStatus, to: NfStatus): void {
  if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} → ${to}`)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "NF acumulada": pending/requested for more than `days` (default 7). */
export function isNfOverdue(status: NfStatus, since: string | null, now: Date = new Date(), days = 7): boolean {
  if (status !== "pending" && status !== "requested") return false
  if (!since) return false
  const start = new Date(since)
  if (Number.isNaN(start.getTime())) return false
  return now.getTime() - start.getTime() > days * DAY_MS
}
