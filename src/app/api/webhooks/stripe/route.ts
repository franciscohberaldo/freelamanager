import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  const body    = await req.text()
  const sig     = req.headers.get("stripe-signature") ?? ""
  const secret  = process.env.STRIPE_WEBHOOK_SECRET ?? ""

  // Verify Stripe signature
  if (secret) {
    const parts = sig.split(",")
    const ts    = parts.find(p => p.startsWith("t="))?.slice(2) ?? ""
    const v1    = parts.find(p => p.startsWith("v1="))?.slice(3) ?? ""
    const computed = createHmac("sha256", secret)
      .update(`${ts}.${body}`)
      .digest("hex")
    if (computed !== v1) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
  }

  const event = JSON.parse(body)
  const supabase = await createClient()

  if (event.type === "checkout.session.completed") {
    const session    = event.data.object
    const invoiceId  = session.metadata?.invoice_id
    const userId     = session.metadata?.user_id
    if (invoiceId && userId) {
      // Mark invoice as paid
      await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .eq("user_id", userId)

      // Update payment link status
      await supabase
        .from("payment_links")
        .update({ status: "paid" })
        .eq("invoice_id", invoiceId)
    }
  }

  return NextResponse.json({ received: true })
}
