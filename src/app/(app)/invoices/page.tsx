import { createClient } from "@/lib/supabase/server"
import { InvoicesClient } from "./invoices-client"

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: invoices, count: invoicesCount }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, jobs(name, currency, clients(name, email))", { count: "exact" })
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .range(0, 24),
    supabase
      .from("invoice_payments")
      .select("invoice_id, amount")
      .eq("user_id", user!.id),
  ])

  const paidMap: Record<string, number> = {}
  payments?.forEach(p => {
    paidMap[p.invoice_id] = (paidMap[p.invoice_id] ?? 0) + p.amount
  })

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, name, hourly_rate, daily_rate, contract_value, billing_mode, project_code, po_number, currency, tax_rate, clients(name, email)")
    .eq("user_id", user!.id)
    .in("status", ["active", "paused", "completed"])
    .order("name")

  return (
    <InvoicesClient
      invoices={(invoices ?? []) as never[]}
      invoicesCount={invoicesCount ?? 0}
      paidMap={paidMap}
      jobs={(jobs ?? []) as unknown as { id: string; name: string; hourly_rate: number; daily_rate: number; billing_mode: "hourly" | "daily" | "fixed"; project_code: string | null; currency: string; tax_rate: number; clients: { name: string; email: string | null } | null }[]}
    />
  )
}
