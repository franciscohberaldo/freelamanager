"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Download, Send, CheckCircle2, Loader2 } from "lucide-react"
import type { Invoice } from "@/lib/supabase/types"
import type { InvoiceLang } from "@/lib/invoice-i18n"

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

  async function sendByEmail(lang: InvoiceLang) {
    setLoading(true)
    const res = await fetch("/api/invoices/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id, lang }),
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

  async function downloadPdf(lang: InvoiceLang) {
    setLoading(true)
    const res = await fetch(`/api/invoices/pdf?id=${invoice.id}&lang=${lang}`)
    if (!res.ok) { toast.error("Erro ao gerar PDF"); setLoading(false); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `invoice-${invoice.invoice_number}-${lang}.pdf`
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
      <DropdownMenuContent align="end" className="w-48">

        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> PDF
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => downloadPdf("pt")} className="pl-6">
          🇧🇷 Português
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadPdf("en")} className="pl-6">
          🇺🇸 English
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> E-mail
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => sendByEmail("pt")} className="pl-6">
          🇧🇷 Português
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => sendByEmail("en")} className="pl-6">
          🇺🇸 English
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
