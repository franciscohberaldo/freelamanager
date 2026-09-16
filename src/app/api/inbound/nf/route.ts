import { NextRequest, NextResponse } from "next/server"
import { verifySignature } from "@/lib/inbound-email"
import { processReceivedEmail } from "@/lib/process-received-email"

/**
 * What the accountant sends back. The webhook only verifies and points at the e-mail;
 * everything else — matching the request, filing the NF, recording the inbox row — lives
 * in `process-received-email`, shared with the hourly poll that catches what the webhook
 * misses.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text()

  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook não configurado" }, { status: 503 })
  const signed = verifySignature({
    secret, body: raw,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    header: request.headers.get("svix-signature"),
  })
  if (!signed) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })

  const event = JSON.parse(raw) as { type?: string; data?: { email_id?: string } }
  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: event.type })

  const emailId = event.data?.email_id
  if (!emailId) return NextResponse.json({ error: "email_id ausente" }, { status: 400 })

  const result = await processReceivedEmail(emailId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })

  return NextResponse.json({ ok: true, filed: result.filed })
}
