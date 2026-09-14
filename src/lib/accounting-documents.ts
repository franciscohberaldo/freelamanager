/**
 * The company's monthly paperwork, which belongs to a month rather than to a job.
 *
 * Everything here turns on *competência*: the month the work was done. The DAS guide for a
 * month is issued at the end of the month after it, so the guide for 11/2025 sits in a
 * folder called 2025_12 and is paid there. Filing both the guide and its receipt under the
 * competência is what puts them on the same line.
 */

export const ACCOUNTING_KINDS = [
  "das_guide", "das_payment", "fee_receipt", "fee_payment",
  "tfe", "dasn_guide", "dasn_payment", "statement",
] as const

export type AccountingKind = (typeof ACCOUNTING_KINDS)[number]
export type CompetenciaScope = "month" | "year"

export const ACCOUNTING_LABELS: Record<AccountingKind, string> = {
  das_guide:    "Guia do DAS",
  das_payment:  "Pagamento do DAS",
  fee_receipt:  "Recibo de honorários",
  fee_payment:  "Pagamento de honorários",
  tfe:          "TFE",
  dasn_guide:   "Guia do DASN",
  dasn_payment: "Pagamento do DASN",
  statement:    "Extrato",
}

/** For table headers, where the full label does not fit. Kept to 10 characters. */
export const ACCOUNTING_SHORT_LABELS: Record<AccountingKind, string> = {
  das_guide:    "DAS",
  das_payment:  "DAS pago",
  fee_receipt:  "Honorár.",
  fee_payment:  "Hon. pago",
  tfe:          "TFE",
  dasn_guide:   "DASN",
  dasn_payment: "DASN pago",
  statement:    "Extrato",
}

export const ACCOUNTING_HINTS: Record<AccountingKind, string> = {
  das_guide:    "A guia que o contador emite no mês seguinte à competência",
  das_payment:  "O comprovante de pagamento da guia",
  fee_receipt:  "O recibo dos honorários do contador",
  fee_payment:  "O comprovante de pagamento dos honorários",
  tfe:          "Taxa de Fiscalização de Estabelecimento",
  dasn_guide:   "A declaração anual do Simples",
  dasn_payment: "O comprovante de pagamento do DASN",
  statement:    "O extrato bancário do mês",
}

export const ACCOUNTING_BUCKET = "accounting-documents"
export const MAX_ACCOUNTING_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]

export type AccountingCheck = { ok: true } | { ok: false; error: string }

export function isAccountingKind(value: string): value is AccountingKind {
  return (ACCOUNTING_KINDS as readonly string[]).includes(value)
}

export function validateAccountingFile(file: { type: string; size: number }): AccountingCheck {
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, error: "Envie um PDF, PNG ou JPG." }
  if (file.size > MAX_ACCOUNTING_BYTES) return { ok: false, error: "O arquivo passa de 10 MB." }
  return { ok: true }
}

// ── What kind of document is this? ───────────────────────────────────────────
/**
 * A word on its own, where "_" counts as a separator. JavaScript's \b does not help here:
 * underscore is a word character, so /\bDAS\b/ misses "2207_DAS_Pagamento.jpg" — which is
 * exactly how these files are named.
 */
const word = (w: string) => new RegExp(`(?:^|[^a-z0-9])${w}(?:$|[^a-z0-9])`, "i")

const DAS = word("das")
const DASN = word("dasn")
const TFE = word("tfe")
const RPS = word("rps")
// Payment beats subject: "DAS_Pagamento" is a payment, not a guide.
const PAID = /pagamento|pagto|comprovante|pago|\bted\b|\bpix\b/i

export function kindFromName(fileName: string): AccountingKind | null {
  const n = fileName
  if (DASN.test(n)) return PAID.test(n) ? "dasn_payment" : "dasn_guide"
  if (TFE.test(n)) return "tfe"
  if (/extrato/i.test(n) || /^NU_\d+_\d{2}[A-Z]{3}\d{4}/i.test(n)) return "statement"
  if (/honorario|honorários|honorarios|contador/i.test(n) || RPS.test(n)) {
    return PAID.test(n) ? "fee_payment" : "fee_receipt"
  }
  if (DAS.test(n) || /simples/i.test(n)) return PAID.test(n) ? "das_payment" : "das_guide"
  return null
}

// ── Which month does it refer to? ────────────────────────────────────────────
const MONTH_WORDS: Record<string, string> = {
  jan: "01", fev: "02", feb: "02", mar: "03", abr: "04", apr: "04",
  mai: "05", may: "05", jun: "06", jul: "07", ago: "08", aug: "08",
  set: "09", sep: "09", out: "10", oct: "10", nov: "11", dez: "12", dec: "12",
}

const valid = (year: string, month: string) =>
  Number(month) >= 1 && Number(month) <= 12 && Number(year) >= 2000 && Number(year) <= 2100
    ? `${year}-${month.padStart(2, "0")}`
    : null

export function previousMonth(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`
}

export type CompetenciaHit = {
  competencia: string
  scope: CompetenciaScope
  /** Where the month came from, so an inferred one can be told from a stated one. */
  from: "nome" | "pasta" | "data do arquivo"
}

/**
 * A date the file carries: AAAAMMDD or AAMMDD. The long form allows trailing digits
 * because these exports append a time — "extrato-202003311119.pdf".
 */
function fileDate(name: string): string | null {
  const long = name.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})\d*/)
  if (long) { const v = valid(long[1], long[2]); if (v) return v }
  const short = name.match(/^(\d{2})(\d{2})(\d{2})(?![\d])/)
  if (short) { const v = valid(`20${short[1]}`, short[2]); if (v) return v }
  return null
}

/** Every shape seen in MaterialCliente, most specific first. */
function monthInName(name: string): string | null {
  // DASN_202101 — an annual declaration, filed as the year it covers.
  const dasn = name.match(/DASN[_ -]?(\d{4})(\d{2})/i)
  if (dasn) return valid(dasn[1], dasn[2])

  // "DAS 11.2025", "REF. MES 02.2022"
  const dotted = name.match(/(?:^|[^\d])(\d{2})\.(\d{4})(?!\d)/)
  if (dotted) return valid(dotted[2], dotted[1])

  // "ref_2201", "_2101_", "_0520." — an explicit reference beats the date the file was
  // made. Read as AAMM first; when that gives an impossible month, it is MMAA instead.
  const ref = name.match(/ref[_ -]?(\d{2})(\d{2})(?![\d])/i)
    ?? name.match(/_(\d{2})(\d{2})(?=_[A-Za-z]|\.[a-z]{3,4}$)/i)
  if (ref) return valid(`20${ref[1]}`, ref[2]) ?? valid(`20${ref[2]}`, ref[1])

  // "Nov2019", "2026-01-Janeiro"
  const word = name.match(/([a-z]{3})[a-z]*[ _-]?(\d{4})/i)
  if (word && MONTH_WORDS[word[1].toLowerCase()]) return valid(word[2], MONTH_WORDS[word[1].toLowerCase()])

  // "2025_12", "2026-01", "2024_06"
  const ymd = name.match(/(?:^|[^\d])(\d{4})[_-](\d{2})(?![\d])/)
  if (ymd) return valid(ymd[1], ymd[2])

  // "01JAN2022" — the period a statement covers
  const span = name.match(/\d{2}([A-Z]{3})(\d{4})/i)
  if (span && MONTH_WORDS[span[1].toLowerCase()]) return valid(span[2], MONTH_WORDS[span[1].toLowerCase()])

  // "Extrato-01-11-2025-a-..." — the day the period opens
  const dashed = name.match(/(\d{2})-(\d{2})-(\d{4})[_ -]?a/i)
  if (dashed) return valid(dashed[3], dashed[2])

  // "2207_DAS_Pagamento" — a bare AAMM prefix, the least specific shape.
  const prefix = name.match(/^(\d{2})(\d{2})[_ -]/)
  if (prefix) return valid(`20${prefix[1]}`, prefix[2])

  return null
}

function monthInFolder(folder: string): string | null {
  const last = folder.split("/").filter(Boolean).pop() ?? ""
  const parent = folder.split("/").filter(Boolean).slice(-2)[0] ?? ""

  const ym = last.match(/^(\d{4})[_-](\d{2})$/)
  if (ym) return valid(ym[1], ym[2])

  const numbered = last.match(/^(\d{2})[_ ]/)          // "09_Setembro"
  if (numbered && /^\d{4}$/.test(parent)) return valid(parent, numbered[1])

  const word = last.match(/^\d{0,2}[_ ]?([a-z]{3})/i)  // "Janeiro" under "2026"
  if (word && MONTH_WORDS[word[1].toLowerCase()] && /^\d{4}$/.test(parent)) {
    return valid(parent, MONTH_WORDS[word[1].toLowerCase()])
  }
  return null
}

export function competenciaFromName(fileName: string, folder = ""): CompetenciaHit | null {
  const named = monthInName(fileName)
  if (named) {
    return { competencia: named, scope: /dasn/i.test(fileName) ? "year" : "month", from: "nome" }
  }

  // The folder is the month the document was handled; the work it refers to is the month
  // before. That is the whole point of the competência.
  const foldered = monthInFolder(folder)
  if (foldered) return { competencia: previousMonth(foldered), scope: "month", from: "pasta" }

  // Loose in a year folder, the date the file carries is all there is — and it is the date
  // it was handled, so the same one-month step back applies.
  const dated = fileDate(fileName)
  if (dated) return { competencia: previousMonth(dated), scope: "month", from: "data do arquivo" }

  return null
}

export function formatCompetencia(competencia: string, scope: CompetenciaScope = "month"): string {
  const [y, m] = competencia.split("-")
  return scope === "year" ? y : `${m}/${y}`
}

export function accountingPath(
  userId: string, competencia: string, kind: AccountingKind, id: string, fileName: string,
): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "pdf"
  return `${userId}/${competencia}/${kind}-${id}.${ext}`
}
