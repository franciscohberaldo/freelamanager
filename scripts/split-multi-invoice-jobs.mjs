// scripts/split-multi-invoice-jobs.mjs — splits jobs that hold several invoices into one
// job per invoice, as each historical entry was a separate job lumped together at import.
//
//   * the original job keeps its oldest invoice and is renamed;
//   * every other invoice gets a new job copied from the original's attributes;
//   * each job is named "<Cliente> — <MM/AAAA>" from the invoice period (on a name
//     collision the seq is appended, e.g. "Lobo — 07/2018 (NFP100)");
//   * the invoice total becomes the job's contract_value, the invoice period its dates.
//
// Only jobs with no documents, projects, agenda events, logs or invoice items are
// touched — anything else is reported and skipped. Run:
//   node scripts/split-multi-invoice-jobs.mjs [--dry]
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")
const OWNER_EMAIL = "franciscohberaldo@gmail.com"

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

const monthYear = (date) => `${date.slice(5, 7)}/${date.slice(0, 4)}`

const { data: jobs, error } = await sb
  .from("jobs")
  .select("*, clients(name), invoices(id, seq_number, invoice_number, period_start, period_end, total, currency)")
  .eq("user_id", uid)
if (error) throw error

const multi = jobs.filter((j) => (j.invoices?.length ?? 0) > 1)
console.log(`${multi.length} jobs com mais de 1 invoice\n`)

// Safety: never split a job that has anything else hanging from it.
const skipped = []
const toSplit = []
for (const j of multi) {
  const [docs, projs, events, logs, items] = await Promise.all([
    sb.from("job_documents").select("id", { count: "exact", head: true }).eq("job_id", j.id),
    sb.from("projects").select("id", { count: "exact", head: true }).eq("job_id", j.id),
    sb.from("agenda_events").select("id", { count: "exact", head: true }).eq("job_id", j.id),
    sb.from("daily_logs").select("id", { count: "exact", head: true }).eq("job_id", j.id),
    sb.from("invoice_items").select("id", { count: "exact", head: true }).in("invoice_id", j.invoices.map((i) => i.id)),
  ])
  const links = { docs: docs.count, projetos: projs.count, agenda: events.count, logs: logs.count, itens: items.count }
  if (Object.values(links).some((n) => n > 0)) skipped.push({ job: j, links })
  else toSplit.push(j)
}
for (const s of skipped)
  console.log(`PULADO (tem vínculos ${JSON.stringify(s.links)}): ${s.job.name} · ${s.job.clients?.name}\n`)

// Final names must be unique across the whole account; existing names count too.
const usedNames = new Set(jobs.filter((j) => !toSplit.includes(j)).map((j) => j.name))

let created = 0, renamed = 0, moved = 0
for (const j of toSplit) {
  const clientName = j.clients?.name ?? "Cliente"
  const invoices = [...j.invoices].sort((a, b) =>
    (a.period_start ?? "").localeCompare(b.period_start ?? "") ||
    (a.seq_number ?? "").localeCompare(b.seq_number ?? ""),
  )
  console.log(`${j.name} · ${clientName} → ${invoices.length} jobs`)

  // First pass: assign names so collisions get the seq suffix.
  const baseNames = invoices.map((inv) => `${clientName} — ${monthYear(inv.period_start)}`)
  const seen = new Map()
  const names = invoices.map((inv, i) => {
    const base = baseNames[i]
    const duplicated = baseNames.indexOf(base) !== i || usedNames.has(base) || seen.has(base)
    const name = duplicated ? `${base} (${inv.seq_number ?? `#${inv.invoice_number}`})` : base
    seen.set(base, true)
    usedNames.add(name)
    return name
  })

  // Fields copied to every new job — everything but identity and timestamps.
  const { id, created_at, updated_at, clients, invoices: _inv, ...template } = j

  for (const [i, inv] of invoices.entries()) {
    const patch = {
      name: names[i],
      contract_value: inv.total,
      currency: inv.currency,
      start_date: inv.period_start,
      end_date: inv.period_end,
    }
    const seq = inv.seq_number ?? `#${inv.invoice_number}`
    if (i === 0) {
      console.log(`  ${seq} · ${inv.period_start} · R$ ${inv.total} → fica no job original, renomeado para "${patch.name}"`)
      renamed++
      if (!dry) {
        const { error: e } = await sb.from("jobs").update(patch).eq("id", j.id)
        if (e) throw e
      }
    } else {
      console.log(`  ${seq} · ${inv.period_start} · R$ ${inv.total} → novo job "${patch.name}"`)
      created++
      moved++
      if (!dry) {
        const { data: newJob, error: e1 } = await sb.from("jobs").insert({ ...template, ...patch }).select("id").single()
        if (e1) throw e1
        const { error: e2 } = await sb.from("invoices").update({ job_id: newJob.id }).eq("id", inv.id)
        if (e2) throw e2
      }
    }
  }
  console.log()
}

console.log(`${dry ? "[dry-run] " : ""}Pronto: ${renamed} jobs originais renomeados, ${created} jobs novos criados, ${moved} invoices movidas`)
