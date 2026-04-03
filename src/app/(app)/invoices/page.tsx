import { createClient } from "@/lib/supabase/server"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CreateInvoiceDialog } from "./create-invoice-dialog"
import { InvoiceActions } from "./invoice-actions"
import { FileText, Plus } from "lucide-react"

const statusMap: Record<string, { label: string; variant: "default" | "outline" | "success" | "warning" | "destructive" }> = {
  draft:   { label: "Rascunho", variant: "outline" },
  sent:    { label: "Enviado",  variant: "warning" },
  paid:    { label: "Pago",     variant: "success" },
  overdue: { label: "Vencido",  variant: "destructive" },
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*, jobs(name, currency, clients(name, email))")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, hourly_rate, daily_rate, currency, tax_rate, clients(name, email)")
    .eq("user_id", user!.id)
    .in("status", ["active", "paused", "completed"])
    .order("name")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground text-sm">{invoices?.length ?? 0} invoices gerados</p>
        </div>
        <CreateInvoiceDialog jobs={(jobs ?? []) as any}>
          <Button><Plus className="w-4 h-4" />Gerar Invoice</Button>
        </CreateInvoiceDialog>
      </div>

      <div className="space-y-3">
        {invoices?.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum invoice gerado ainda.</p>
            </CardContent>
          </Card>
        )}
        {invoices?.map((inv) => {
          const job = inv.jobs as { name: string; currency: string; clients: { name: string; email: string | null } | null } | null
          const s = statusMap[inv.status] ?? { label: inv.status, variant: "outline" as const }
          return (
            <Card key={inv.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">#{inv.invoice_number}</span>
                    <Badge variant={s.variant as "default"}>{s.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {job?.name} · {job?.clients?.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(inv.period_start)} – {formatDate(inv.period_end)} · {inv.total_hours_billed}h faturadas
                  </p>
                  {inv.paid_at && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      Pago em {formatDate(inv.paid_at)}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold">{formatCurrency(inv.total, inv.currency)}</p>
                  {inv.tax_amount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Líq: {formatCurrency(inv.subtotal, inv.currency)} + {formatCurrency(inv.tax_amount, inv.currency)} imp.
                    </p>
                  )}
                </div>
                <InvoiceActions invoice={inv} clientEmail={job?.clients?.email ?? null} />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
