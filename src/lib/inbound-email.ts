import { createHmac, timingSafeEqual } from "crypto"

/** The address a reply comes back to, carrying the id of the request it answers. */
export function replyAddress(requestId: string, domain: string | undefined): string | null {
  return domain ? `nf+${requestId}@${domain}` : null
}

/** The request id an incoming address was tagged with, from any of the fields it may sit in. */
export function requestIdFrom(addresses: (string | null | undefined)[]): string | null {
  for (const address of addresses) {
    const found = address?.match(/nf\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i)
    if (found) return found[1].toLowerCase()
  }
  return null
}

/** The file a note arrives as; anything else is recorded but not filed. */
export function isNfAttachment(a: { filename?: string | null; content_type?: string | null }): boolean {
  if (a.content_type === "application/pdf") return true
  return !!a.filename?.toLowerCase().endsWith(".pdf")
}

/**
 * Resend signs webhooks the Svix way: the secret is base64 after the `whsec_` prefix, and
 * what is signed is the id, the timestamp and the body, joined by dots. A header can carry
 * several space-separated signatures, each as `v1,<base64>` — one of them has to match.
 */
export function verifySignature({ secret, id, timestamp, body, header }: {
  secret: string
  id: string | null
  timestamp: string | null
  body: string
  header: string | null
}): boolean {
  if (!id || !timestamp || !header) return false

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64")
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest()

  return header.split(" ").some(part => {
    const [version, value] = part.split(",")
    if (version !== "v1" || !value) return false
    const given = Buffer.from(value, "base64")
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
