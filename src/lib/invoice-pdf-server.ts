/**
 * The invoice PDF as the server renders it. Viewing, downloading and attaching to the
 * e-mail all go through here, so the client receives the very file "Visualizar" opens.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateInvoicePDF, type InvoicePDFParams } from "@/lib/invoice-pdf"
import { itemsFromLogs } from "@/lib/invoice-items"
import { invoiceLangFor, type InvoiceLang } from "@/lib/invoice-i18n"

export async function renderInvoicePdf(
  supabase: SupabaseClient,
  userId: string,
  invoiceId: string,
  forcedLang?: InvoiceLang | null,
): Promise<{ bytes: ArrayBuffer; fileName: string } | null> {
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, jobs(name, hourly_rate, daily_rate, billing_mode, project_code, currency, contract_value, clients(name, company, email, legal_name, cnpj, address, billing_entity, billing_address))")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single(),
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ])

  if (!invoice) return null

  const lang = forcedLang ?? invoiceLangFor(invoice.currency)

  const { data: items } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("date")

  const job    = invoice.jobs as {
    name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"; project_code: string | null; currency: string; contract_value: number | null
    clients: {
      name: string; company: string | null; email: string | null
      legal_name: string | null; cnpj: string | null; address: string | null; billing_entity: string | null; billing_address: string | null
    } | null
  } | null
  const client = job?.clients ?? null

  // An invoice without stored items still owes the client the worked days.
  let itemRows: InvoicePDFParams["items"] = items ?? []
  if (itemRows.length === 0 && job) {
    const { data: logs } = await supabase
      .from("daily_logs")
      .select("date, hours_billed, total_value")
      .eq("job_id", invoice.job_id)
      .gte("date", invoice.period_start)
      .lte("date", invoice.period_end)
      .order("date")
    itemRows = itemsFromLogs(logs ?? [], job, invoice)
  }

  const bytes = await generateInvoicePDF({
    invoice,
    items: itemRows,
    job: job ? {
      name: job.name, hourly_rate: job.hourly_rate, daily_rate: job.daily_rate,
      billing_mode: job.billing_mode, project_code: job.project_code, currency: job.currency,
    } : null,
    client,
    settings,
    lang,
  })

  return { bytes, fileName: invoicePdfFileName(invoice) }
}

export const invoicePdfFileName = (invoice: { seq_number?: string | null; invoice_number: string }) =>
  `invoice-${invoice.seq_number ?? invoice.invoice_number}.pdf`
