// scripts/check-all-logs.mjs — count all daily_logs and show the 20 most recent,
// to confirm whether the calendar "add diária" flow has ever persisted anything.
// Run: node scripts/check-all-logs.mjs
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

const { count } = await sb.from("daily_logs").select("*", { count: "exact", head: true }).eq("user_id", uid)
console.log("total daily_logs (todos os tempos):", count)

const { data: logs } = await sb
  .from("daily_logs")
  .select("id, date, hours_billed, created_at, jobs(name, clients(name))")
  .eq("user_id", uid)
  .order("created_at", { ascending: false })
  .limit(20)
for (const l of logs ?? []) {
  console.log(l.created_at?.slice(0, 16), "|", l.date, "|", l.jobs?.clients?.name, "|", l.jobs?.name, "|", l.hours_billed, "h")
}
