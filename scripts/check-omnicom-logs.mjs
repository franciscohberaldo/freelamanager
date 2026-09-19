// scripts/check-omnicom-logs.mjs — inspect the Omnicom Website job and its daily_logs
// around 2026-09 to find out why "Gerar Invoice" says there is nothing to bill.
// Run: node scripts/check-omnicom-logs.mjs
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

const { data: jobs } = await sb
  .from("jobs")
  .select("id, name, billing_mode, hourly_rate, daily_rate, currency, clients(name)")
  .eq("user_id", uid)
  .ilike("name", "%omnicom%")

console.log("== jobs ==")
for (const j of jobs ?? []) console.log(j.id, "|", j.name, "|", j.billing_mode, "|", j.clients?.name)

for (const j of jobs ?? []) {
  const { data: logs } = await sb
    .from("daily_logs")
    .select("id, date, hours_billed, total_value, invoice_id")
    .eq("job_id", j.id)
    .order("date")
  console.log(`\n== daily_logs for ${j.name} (${logs?.length ?? 0}) ==`)
  for (const l of logs ?? []) console.log(l.date, "|", l.hours_billed, "h |", l.total_value, "| invoice:", l.invoice_id)
}
