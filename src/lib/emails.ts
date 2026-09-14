/**
 * A client's e-mail field holds one address or several.
 *
 * Some companies want two or three people on every invoice, and typing them into the one
 * field is the first thing anyone tries. The first address is the recipient and the rest
 * are copied — which is also why the parser keeps the order it was given.
 *
 * Everything that consumes the field goes through here, because not every consumer can
 * take a list: Stripe's customer_email, for one, accepts exactly one address.
 */

/** Deliberately plain: enough to catch a typo, not a spec-complete grammar. */
const ONE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)+$/

export function isValidEmail(value: string): boolean {
  return ONE.test(value.trim())
}

export function parseEmails(value: string | null | undefined): string[] {
  if (!value) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const piece of value.split(/[,;\n]/)) {
    const one = piece.trim().toLowerCase()
    if (!one || seen.has(one)) continue
    seen.add(one)
    out.push(one)
  }
  return out
}

/** Who the message is addressed to. */
export function primaryEmail(value: string | null | undefined): string | null {
  return parseEmails(value)[0] ?? null
}

/** Who else is on it. */
export function extraEmails(value: string | null | undefined): string[] {
  return parseEmails(value).slice(1)
}

export type EmailListCheck = { ok: true } | { ok: false; error: string }

export function validateEmailList(value: string | null | undefined): EmailListCheck {
  const list = parseEmails(value)
  if (list.length === 0) return { ok: true }
  const bad = list.find(e => !isValidEmail(e))
  return bad ? { ok: false, error: `"${bad}" não parece um e-mail` } : { ok: true }
}
