"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PortalInvoice {
  id: string
  invoice_number: string
  total: number
  currency: string
  status: string
  period_start: string
  period_end: string
  due_date: string | null
  client_confirmed_at: string | null
}

interface PortalInvoicesProps {
  invoices: PortalInvoice[]
  token: string
}

const INV_STATUS: Record<string, { label: string; class: string }> = {
  draft:   { label: "Rascunho", class: "bg-gray-100 text-gray-600" },
  sent:    { label: "Enviado",  class: "bg-amber-100 text-amber-700" },
  paid:    { label: "Pago",     class: "bg-green-100 text-green-700" },
  overdue: { label: "Vencido",  class: "bg-red-100 text-red-700" },
}

export function PortalInvoices({ invoices, token }: PortalInvoicesProps) {
  const [confirmedIds, setConfirmedIds] = useState<Record<string, string>>({})
  const [loadingDownload, setLoadingDownload] = useState<string | null>(null)
  const [loadingConfirm, setLoadingConfirm] = useState<string | null>(null)

  async function handleDownload(invoiceId: string, invoiceNumber: string) {
    setLoadingDownload(invoiceId)
    try {
      const res = await fetch(`/api/portal/pdf?token=${encodeURIComponent(token)}&invoice_id=${encodeURIComponent(invoiceId)}`)
      if (!res.ok) {
        console.error("PDF download failed:", res.status)
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `invoice-${invoiceNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("PDF download error:", err)
    } finally {
      setLoadingDownload(null)
    }
  }

  async function handleConfirm(invoiceId: string) {
    setLoadingConfirm(invoiceId)
    try {
      const res = await fetch("/api/portal/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, invoice_id: invoiceId }),
      })
      if (!res.ok) {
        console.error("Confirm payment failed:", res.status)
        return
      }
      const data = await res.json()
      setConfirmedIds(prev => ({ ...prev, [invoiceId]: data.confirmed_at }))
    } catch (err) {
      console.error("Confirm payment error:", err)
    } finally {
      setLoadingConfirm(null)
    }
  }

  function canConfirm(inv: PortalInvoice): boolean {
    if (confirmedIds[inv.id]) return false
    if (inv.client_confirmed_at) return false
    return inv.status === "sent" || inv.status === "overdue"
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-3">Invoices</h2>
      <div className="bg-white rounded-xl border divide-y">
        {invoices.map(inv => {
          const st = INV_STATUS[inv.status] ?? { label: inv.status, class: "bg-gray-100 text-gray-600" }
          const isConfirmed = !!confirmedIds[inv.id] || !!inv.client_confirmed_at
          return (
            <div key={inv.id} className="px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{inv.invoice_number}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(inv.period_start + "T12:00"), "MMM yyyy", { locale: ptBR })}
                    {inv.due_date && ` · vence ${format(new Date(inv.due_date + "T12:00"), "dd/MM")}`}
                  </p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${st.class}`}>
                    {st.label}
                  </span>
                  {isConfirmed && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      Confirmado
                    </span>
                  )}
                  <p className="font-semibold text-gray-900">{formatCurrency(inv.total, inv.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => handleDownload(inv.id, inv.invoice_number)}
                  disabled={loadingDownload === inv.id}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {loadingDownload === inv.id ? "Baixando..." : "Download PDF"}
                </button>
                {canConfirm(inv) && (
                  <button
                    onClick={() => handleConfirm(inv.id)}
                    disabled={loadingConfirm === inv.id}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {loadingConfirm === inv.id ? "Confirmando..." : "Confirmar pagamento"}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
