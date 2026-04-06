import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createHmac } from "crypto"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { webhookId } = await req.json()

  const { data: hook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", webhookId)
    .eq("user_id", user.id)
    .single()

  if (!hook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 })

  const payload = JSON.stringify({
    event:     "test",
    data:      { message: "Teste de webhook do Freela Manager", timestamp: new Date().toISOString() },
    fired_at:  new Date().toISOString(),
  })
  const sig = createHmac("sha256", hook.secret).update(payload).digest("hex")

  let status_code: number | null = null
  let response: string | null = null
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type":       "application/json",
        "X-Freela-Signature": `sha256=${sig}`,
        "X-Freela-Event":     "test",
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    })
    status_code = res.status
    response    = await res.text().catch(() => null)
  } catch (err) {
    response = err instanceof Error ? err.message : "timeout"
  }

  await supabase.from("webhook_deliveries").insert({
    webhook_id:  hook.id,
    event:       "test",
    payload:     { message: "Teste" },
    status_code,
    response,
  })

  return NextResponse.json({ status_code, response })
}
