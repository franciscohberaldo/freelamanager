import type { NextRequest } from "next/server"

/**
 * Verifies a cron request.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET
 * env var is set. The `x-cron-secret` header and `?secret=` query param are
 * kept for manual triggers (e.g. the "Testar" button in /automacoes).
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim()
  const header = req.headers.get("x-cron-secret")
  const query  = req.nextUrl.searchParams.get("secret")

  return [bearer, header, query].some((v) => v && v === expected)
}
