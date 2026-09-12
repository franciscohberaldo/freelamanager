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
