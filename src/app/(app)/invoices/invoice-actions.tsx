"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Send, CheckCircle2, Loader2 } from "lucide-react"
import type { Invoice } from "@/lib/supabase/types"

interface Props {
  invoice: Invoice
  clientEmail: string | null
}

export function InvoiceActions({ invoice, clientEmail }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function markPaid() {
    setLoading(true)
    const { error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", invoice.id)
    if (error) toast.error("Erro ao atualizar")
    else { toast.success("Marcado como pago!"); router.refresh() }
    setLoading(false)
  }

  async function sendByEmail() {
    setLoading(true)
    const res = await fetch("/api/invoices/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success("Invoice enviado por e-mail!")
      router.refresh()
    } else {
      toast.error(data.error ?? "Erro ao enviar e-mail")
    }
    setLoading(false)
  }

  async function downloadPdf() {
    setLoading(true)
    const res = await fetch(`/api/invoices/pdf?id=${invoice.id}`)
    if (!res.ok) { toast.error("Erro ao gerar PDF"); setLoading(false); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoice-${invoice.invoice_number}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={downloadPdf}>
          <Download className="w-4 h-4" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={sendByEmail}>
          <Send className="w-4 h-4" />
          Enviar por e-mail
        </DropdownMenuItem>
        {invoice.status !== "paid" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={markPaid} className="text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Marcar como pago
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
