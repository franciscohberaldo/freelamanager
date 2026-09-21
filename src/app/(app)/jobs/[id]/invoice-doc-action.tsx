"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CreateInvoiceDialog } from "@/app/(app)/invoices/create-invoice-dialog"
import { SendEmailDialog } from "@/components/send-email-dialog"
import { DOCUMENT_BUCKET, documentPath } from "@/lib/job-documents"
import { invoiceLangFor } from "@/lib/invoice-i18n"
import type { BillingMode } from "@/lib/billing-mode"
import { FilePlus2, Send, Eye } from "lucide-react"

interface JobOption {
  id: string
  name: string
  hourly_rate: number
  daily_rate: number
  contract_value?: number | null
  billing_mode?: BillingMode
  project_code?: string | null
  po_number?: string | null
  start_date?: string | null
  end_date?: string | null
  currency: string
  tax_rate: number
  clients: { name: string; email: string | null } | null
}

interface JobInvoice {
  id: string
  seq_number: string | null
  invoice_number: string
  status: string
  currency: string
}

/**
 * The invoice slot on the job's documents: besides holding an uploaded file, it can
 * create the invoice here, open it as the client will see it, and send it. A sent
 * invoice archives its own PDF into the slot, so the card always shows what the client
 * received. Renders its buttons bare, so the panel can lay them on one line.
 */
export function InvoiceDocAction({
  job, invoices, userId,
}: {
  job: JobOption
  invoices: JobInvoice[]
  userId: string
}) {
  const [sendOpen, setSendOpen] = useState(false)
  const supabase = createClient()

  // the invoice to act on: the newest draft, else the newest one whatever its state
  const target = [...invoices].sort((a, b) => b.invoice_number.localeCompare(a.invoice_number))
    .sort((a, b) => Number(a.status !== "draft") - Number(b.status !== "draft"))[0]
  const label = target ? (target.seq_number ?? target.invoice_number) : null
  const lang = target ? invoiceLangFor(target.currency) : "pt"

  function viewInvoice() {
    if (!target) return
    window.open(`/api/invoices/pdf?id=${target.id}&inline=1`, "_blank", "noopener")
  }

  // After a successful send, archive the exact PDF the client received into this slot.
  async function archiveSentPdf() {
    if (!target) return
    const pdfRes = await fetch(`/api/invoices/pdf?id=${target.id}&lang=${lang}`)
    if (!pdfRes.ok) return
    const blob = await pdfRes.blob()
    const fileName = `invoice-${label}.pdf`
    const path = documentPath(userId, job.id, "invoice", fileName)
    const { error: upErr } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, blob, { upsert: true, contentType: "application/pdf" })
    if (upErr) { toast.error("Invoice enviada, mas o PDF não foi anexado aos documentos"); return }
    await supabase.from("job_documents").upsert({
      user_id: userId, job_id: job.id, kind: "invoice",
      path, file_name: fileName, mime_type: "application/pdf", size_bytes: blob.size,
    }, { onConflict: "job_id,kind" })
  }

  return (
    <>
      <CreateInvoiceDialog jobs={[job]}>
        <Button variant="outline" size="sm">
          <FilePlus2 className="w-3 h-3" />
          Criar invoice
        </Button>
      </CreateInvoiceDialog>
      <Button variant="outline" size="sm" onClick={viewInvoice} disabled={!target}>
        <Eye className="w-3 h-3" />
        {label ? `Visualizar ${label}` : "Visualizar"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setSendOpen(true)} disabled={!target}>
        <Send className="w-3 h-3" />
        {label ? `Enviar ${label}` : "Enviar"}
      </Button>
      {target && (
        <SendEmailDialog
          invoiceId={target.id}
          lang={lang}
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          onSent={archiveSentPdf}
        />
      )}
    </>
  )
}
