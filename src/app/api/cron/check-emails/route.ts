/**
 * GET|POST /api/cron/check-emails
 *
 * Called hourly by Vercel Cron. The webhook is the fast path for inbound mail, but a
 * missed delivery would lose the e-mail for good — this asks Resend what it received and
 * imports whatever the inbox does not have yet.
 */
import { NextRequest, NextResponse } from "next/server"
import { isCronAuthorized } from "@/lib/cron-auth"
import { pollNewEmails } from "@/lib/process-received-email"

async function run(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await pollNewEmails()
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
