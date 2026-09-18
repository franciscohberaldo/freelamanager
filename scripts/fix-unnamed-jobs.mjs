// scripts/fix-unnamed-jobs.mjs — the 20 blank-named jobs are historical shells that
// each hold exactly one invoice and nothing else. Name them "Cliente — MM/AAAA" from
// the invoice period (appending the invoice number on collisions), and fill dates and
// contract_value from the invoice, matching the convention of the split script.
// Run: node scripts/fix-unnamed-jobs.mjs [--dry]
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")

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
  .select("id, name, start_date, end_date, contract_value, clients(name)")
  .eq("user_id", uid)
const usedNames = new Set(jobs.map((j) => j.name).filter(Boolean))
const blank = jobs.filter((j) => !j.name || !j.name.trim())

let updated = 0
for (const j of blank) {
  const { data: invs } = await sb
    .from("invoices")
    .select("invoice_number, period_start, period_end, total")
    .eq("job_id", j.id)
    .order("period_start")
  const inv = invs?.[0]
  if (!inv) { console.log(`SKIP ${j.id} — sem invoice`); continue }

  const month = inv.period_start.slice(5, 7)
  const year = inv.period_start.slice(0, 4)
  let name = `${j.clients?.name ?? "Cliente"} — ${month}/${year}`
  if (usedNames.has(name)) name = `${name} (${inv.invoice_number})`
  usedNames.add(name)

  const patch = {
    name,
    start_date: j.start_date ?? inv.period_start,
    end_date: j.end_date ?? inv.period_end,
    contract_value: j.contract_value ?? (inv.total > 0 ? inv.total : null),
  }
  console.log(`${dry ? "[dry] " : ""}${j.id} → "${name}" (${inv.period_start}→${inv.period_end}, ${inv.total})`)
  if (!dry) {
    const { error } = await sb.from("jobs").update(patch).eq("id", j.id)
    if (error) { console.error(`  ERRO: ${error.message}`); continue }
  }
  updated++
}
console.log(`\n${updated}/${blank.length} jobs ${dry ? "seriam atualizados" : "atualizados"}`)
