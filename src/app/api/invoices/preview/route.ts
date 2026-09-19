import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { generateInvoicePDF } from "@/lib/invoice-pdf"
import { invoiceLangFor } from "@/lib/invoice-i18n"
import type { DraftItem } from "@/lib/invoice-draft"

interface PreviewBody {
  jobId: string
  periodStart: string
  periodEnd: string
  dueDate?: string | null
  notes?: string | null
  poNumber?: string | null
  items: DraftItem[]
  subtotal: number
  taxRate: number
}

/**
 * The invoice as it will print, before it exists. The dialog sends the lines it is about
 * to store; this renders them through the same generator as the real PDF, so what the
 * user sees while editing is what the client will receive.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const body = (await request.json()) as PreviewBody
  if (!body?.jobId || !body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "Job e período são obrigatórios" }, { status: 400 })
  }

  const [{ data: job }, { data: settings }] = await Promise.all([
    supabase
      .from("jobs")
      .select("name, hourly_rate, daily_rate, billing_mode, project_code, currency, contract_value, clients(name, company, email, legal_name, cnpj, address, billing_entity, billing_address)")
      .eq("id", body.jobId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single(),
  ])
  if (!job) return NextResponse.json({ error: "Job não encontrado" }, { status: 404 })

  const typedJob = job as unknown as {
    name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"
    project_code: string | null; currency: string; contract_value: number | null
    clients: {
      name: string; company: string | null; email: string | null
      legal_name: string | null; cnpj: string | null; address: string | null; billing_entity: string | null; billing_address: string | null
    } | null
  }

  const taxRate   = Number(body.taxRate) || 0
  const subtotal  = Number(body.subtotal) || 0
  const taxAmount = subtotal * (taxRate / 100)

  const pdfBytes = await generateInvoicePDF({
    invoice: {
      invoice_number: "preview",
      seq_number: null,
      po_number: body.poNumber?.trim() || typedJob.project_code || null,
      period_start: body.periodStart,
      period_end: body.periodEnd,
      due_date: body.dueDate || null,
      currency: typedJob.currency,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total: subtotal + taxAmount,
      notes: body.notes?.trim() || null,
      created_at: null,   // dated today, like an invoice issued now
    },
    items: (body.items ?? []).map(i => ({
      date: i.date, hours_billed: i.hours_billed, rate: i.rate, subtotal: i.subtotal,
      quantity: i.quantity, unit: i.unit, description: i.description ?? null,
      job_number: i.job_number ?? null, is_manual: i.is_manual ?? null,
    })),
    job: {
      name: typedJob.name, hourly_rate: typedJob.hourly_rate, daily_rate: typedJob.daily_rate,
      billing_mode: typedJob.billing_mode, project_code: typedJob.project_code, currency: typedJob.currency,
    },
    client: typedJob.clients,
    settings,
    lang: invoiceLangFor(typedJob.currency),
  })

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-preview.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
