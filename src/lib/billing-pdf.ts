/**
 * The accountant's billing PDFs (recibo de honorários, guias) carry the due date and the
 * amount as text inside the PDF — "Data de Vencimento: 21/09/2026", "R$ 202,00".
 */
import { extractText } from "unpdf"

export type BillingInfo = {
  /** ISO date (YYYY-MM-DD) of the due date, when the PDF states one. */
  dueDate: string | null
  /** The first "R$ …" figure in the document, in reais. */
  amount: number | null
}

export async function billingInfoFromPdf(bytes: Buffer): Promise<BillingInfo> {
  try {
    const { text } = await extractText(new Uint8Array(bytes), { mergePages: true })
    const due = text.match(/vencimento[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i)
    const amt = text.match(/R\$\s*([\d.]*\d,\d{2})/)
    return {
      dueDate: due ? `${due[3]}-${due[2]}-${due[1]}` : null,
      amount: amt ? Number(amt[1].replace(/\./g, "").replace(",", ".")) : null,
    }
  } catch {
    return { dueDate: null, amount: null }
  }
}
