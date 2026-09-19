// scripts/check-recent-logs.mjs — list all daily_logs in Sep 2026 across jobs,
// to see whether calendar diárias landed on a different job.
// Run: node scripts/check-recent-logs.mjs
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users } = await sb.auth.admin.listUsers()
const uid = users.users.find((u) => u.email === "franciscohberaldo@gmail.com").id

const { data: logs, error } = await sb
  .from("daily_logs")
  .select("id, date, hours_billed, total_value, job_id, jobs(name, clients(name))")
  .eq("user_id", uid)
  .gte("date", "2026-09-01")
  .lte("date", "2026-09-30")
  .order("date")

if (error) { console.error(error); process.exit(1) }
console.log(`total daily_logs em 09/2026: ${logs?.length ?? 0}`)
for (const l of logs ?? []) {
  console.log(l.date, "|", l.jobs?.clients?.name, "|", l.jobs?.name, "|", l.hours_billed, "h |", l.total_value)
}
