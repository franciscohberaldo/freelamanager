import { createClient } from "@/lib/supabase/server"
import { createHmac } from "crypto"
import type { WebhookEvent } from "./webhook-events"
export { WEBHOOK_EVENTS } from "./webhook-events"
export type { WebhookEvent } from "./webhook-events"

export async function dispatchWebhook(userId: string, event: WebhookEvent, payload: unknown) {
  const supabase = await createClient()

  const { data: hooks } = await supabase
    .from("webhooks")
    .select("id, url, secret, events")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (!hooks?.length) return

  const matching = hooks.filter(h => (h.events as string[]).includes(event))

  await Promise.allSettled(
    matching.map(async hook => {
      const body = JSON.stringify({ event, data: payload, fired_at: new Date().toISOString() })
      const sig  = createHmac("sha256", hook.secret).update(body).digest("hex")

      let status_code: number | null = null
      let response: string | null = null
      try {
        const res = await fetch(hook.url, {
          method:  "POST",
          headers: {
            "Content-Type":        "application/json",
            "X-Freela-Signature":  `sha256=${sig}`,
            "X-Freela-Event":      event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        })
        status_code = res.status
        response    = await res.text().catch(() => null)
      } catch (err) {
        response = err instanceof Error ? err.message : "timeout"
      }

      // Log delivery
      await supabase.from("webhook_deliveries").insert({
        webhook_id: hook.id,
        event,
        payload:    payload as Record<string, unknown>,
        status_code,
        response,
      })

      // Update last_fired
      await supabase.from("webhooks").update({ last_fired: new Date().toISOString() }).eq("id", hook.id)
    })
  )
}
