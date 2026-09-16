// scripts/backfill-nf-series.mjs — fills nf_series on invoices imported before the column
// existed. The series is derived from the issue date (nf_issued_at ?? period_start ??
// created_at): before 2020-01-01 the company issued through Paulínia (PLN), from that
// date on through São Paulo (SP). Idempotent — only touches rows with nf_series null
// and an NF number present. Run: node scripts/backfill-nf-series.mjs [--dry]
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")
const OWNER_EMAIL = "franciscohberaldo@gmail.com"
const CUTOFF = "2020-01-01"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users, error: usersError } = await sb.auth.admin.listUsers()
if (usersError) throw usersError
const owner = users.users.find((u) => u.email === OWNER_EMAIL)
if (!owner) throw new Error(`User ${OWNER_EMAIL} not found`)
const uid = owner.id

const { data: rows, error } = await sb
  .from("invoices")
  .select("id, seq_number, invoice_number, nf_number, nf_issued_at, period_start, created_at")
  .eq("user_id", uid)
  .is("nf_series", null)
  .not("nf_number", "is", null)
if (error) throw error

console.log(`${rows.length} invoices com NF e sem série gravada`)

const counts = { paulinia: 0, sao_paulo: 0 }
const noDate = []
for (const r of rows) {
  const date = r.nf_issued_at ?? r.period_start ?? r.created_at?.slice(0, 10) ?? null
  if (!date) { noDate.push(r); continue }
  const series = date < CUTOFF ? "paulinia" : "sao_paulo"
  counts[series]++
  const label = r.seq_number ?? `#${r.invoice_number}`
  console.log(`  ${label} · NF ${r.nf_number} · ${date} → ${series === "paulinia" ? "PLN" : "SP"}`)
  if (!dry) {
    const { error: upError } = await sb.from("invoices").update({ nf_series: series }).eq("id", r.id)
    if (upError) throw upError
  }
}

console.log()
console.log(`${dry ? "[dry-run] " : ""}Paulínia (PLN): ${counts.paulinia} · São Paulo (SP): ${counts.sao_paulo}`)
if (noDate.length) console.log(`Sem data para derivar (não alteradas): ${noDate.map(r => r.seq_number ?? r.invoice_number).join(", ")}`)
