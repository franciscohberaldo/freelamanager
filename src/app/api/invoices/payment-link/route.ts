import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { invoiceId } = await req.json()
  if (!invoiceId) return NextResponse.json({ error: "invoiceId required" }, { status: 400 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, currency, jobs(name, clients(name, email))")
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .single()

  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY não configurada. Configure em Vercel → Settings → Environment Variables." }, { status: 500 })
  }

  const job    = invoice.jobs as unknown as { name: string; clients: { name: string; email: string | null } | null } | null
  const client = (job?.clients as unknown as { name: string; email: string | null } | null)

  // Create Stripe Checkout Session
  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price_data][currency]": invoice.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(Math.round(invoice.total * 100)),
    "line_items[0][price_data][product_data][name]": `Invoice #${invoice.invoice_number}`,
    "line_items[0][price_data][product_data][description]": job?.name ?? "Serviços freelance",
    "line_items[0][quantity]": "1",
    "mode": "payment",
    "success_url": `${process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? ""}/invoices?paid=1`,
    "cancel_url": `${process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? ""}/invoices`,
    "metadata[invoice_id]": invoiceId,
    "metadata[user_id]": user.id,
  })

  if (client?.email) params.set("customer_email", client.email)

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  const session = await stripeRes.json()
  if (!stripeRes.ok) {
    return NextResponse.json({ error: session.error?.message ?? "Erro no Stripe" }, { status: 500 })
  }

  // Store the payment link
  await supabase.from("payment_links").insert({
    user_id:    user.id,
    invoice_id: invoiceId,
    provider:   "stripe",
    link_url:   session.url,
    status:     "pending",
  })

  return NextResponse.json({ url: session.url })
}
