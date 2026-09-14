/** The paperwork a job accumulates. One file per kind; uploading again replaces it. */
export const DOCUMENT_KINDS = [
  "contract", "invoice", "accountant_email", "nf", "das_issued", "das_paid", "payment_proof",
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  contract:         "Contrato",
  invoice:          "Invoice enviada",
  accountant_email: "Email pro contador",
  nf:               "NF emitida",
  das_issued:       "DAS emitido",
  das_paid:         "DAS pago",
  payment_proof:    "Pagamento recebido",
}

/** For table headers, where the full label does not fit. Kept to 10 characters. */
export const DOCUMENT_SHORT_LABELS: Record<DocumentKind, string> = {
  contract:         "Contrato",
  invoice:          "Invoice",
  accountant_email: "Contador",
  nf:               "NF",
  das_issued:       "DAS emit.",
  das_paid:         "DAS pago",
  payment_proof:    "Comprov.",
}

export const DOCUMENT_HINTS: Record<DocumentKind, string> = {
  contract:         "Contrato ou ordem de serviço assinada",
  invoice:          "A invoice enviada ao tomador",
  accountant_email: "O email pedindo a NF ao contador",
  nf:               "A nota fiscal emitida pelo contador",
  das_issued:       "A guia do DAS que o contador emitiu",
  das_paid:         "O DAS já pago, com autenticação",
  payment_proof:    "Comprovante do dinheiro que entrou",
}

export const DOCUMENT_BUCKET = "job-documents"
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

/** Mirrors the bucket's allowed_mime_types in migration 018. */
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"]

export type DocumentCheck = { ok: true } | { ok: false; error: string }

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value)
}

export function validateDocument(file: { type: string; size: number }): DocumentCheck {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "Envie um PDF, PNG ou JPG." }
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, error: "O arquivo passa de 10 MB." }
  }
  return { ok: true }
}

/**
 * Naming the file after its kind is what makes re-uploading a replacement: the path is
 * stable, so an `upsert` overwrites the old file instead of orphaning it in the bucket.
 */
export function documentPath(
  userId: string, jobId: string, kind: DocumentKind, fileName: string,
): string {
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "pdf"
  return `${userId}/${jobId}/${kind}.${ext}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}
