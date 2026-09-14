// scripts/rebuild-history-jobs.mjs — idempotent. Run: node scripts/rebuild-history-jobs.mjs [--dry]
//
// The first import anchored every historical invoice to a single "Histórico <Cliente>" job,
// so the job history read as one row per client. This splits those anchors into one job per
// actual job, recovering names from the NF filenames and the tracking spreadsheet.
// A job whose name cannot be recovered is created blank, to be filled in later by hand.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users } = await sb.auth.admin.listUsers()
const uid = users.users.find(u => u.email === "franciscohberaldo@gmail.com").id

function csv(path) {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "")
  const [head, ...rows] = text.split(/\r?\n/).filter(Boolean)
  const cols = head.split(",")
  return rows.map(line => {
    const vals = []; let cur = "", q = false
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { vals.push(cur); cur = "" } else cur += ch }
    vals.push(cur); return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? "").trim()]))
  })
}

const ascii = s => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Company tokens that show up inside filenames but are never the job: the tomador itself and
// the sister companies that share the group (a file reads "Lobo_Havaianas" under Videographica).
const COMPANY_TOKENS = [
  "videographica", "lobo", "cinemalink", "kumite", "samtransmedia", "polis", "maisfilmes",
  "jofilsan", "capela", "quanta", "tollmeiner", "a00", "arvore", "tabuleiro", "filmes",
  "estudiojudite", "judite", "deutschinc", "deutsch", "omnicom", "invisibleworks", "rga",
]

const splitCamel = s => s
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
  .trim()

const isNoise = p =>
  /^(nf|nfe|nfse)?0*\d{1,4}$/i.test(p) || /^\d{6}$/.test(p) || /^\d{2}$/.test(p) ||
  /^v\d$/i.test(p) || /^(copy|final|invoice|pdf)$/i.test(p)

/** Job name recovered from an NF filename, or "" when nothing recognisable is left. */
export function jobFromFilename(file) {
  let base = file.replace(/(\.pdf)+$/i, "").replace(/\s*\(\d+\)$/, "")
  return base
    .split(/[_\-]+/)
    .flatMap(p => {
      const m = p.match(/^(\d{6})(.+)$/)          // date glued to the name: "180719Videographica"
      return m ? [m[2]] : [p]
    })
    .filter(p => p && !isNoise(p))
    .filter(p => !COMPANY_TOKENS.includes(ascii(p).replace(/[^a-z0-9]/g, "")))
    .map(splitCamel)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

// ---- 1. seq_number -> job name -------------------------------------------------------------
const names = new Map()   // seq_number -> string ("" means leave blank)
const conflicts = []

for (const r of csv("MaterialCliente/nf_historico_paulinia.csv").filter(r => r.tipo === "nfse" && r.nf)) {
  const seq = `NFP${r.nf.padStart(3, "0")}`
  const name = jobFromFilename(r.file)
  if (names.has(seq) && names.get(seq) !== name) {
    // two source files disagree about this NF — not confident, so leave it blank
    conflicts.push(`${seq}: "${names.get(seq)}" vs "${name}"`)
    names.set(seq, "")
  } else if (!names.has(seq)) {
    names.set(seq, name)
  }
}

for (const r of csv("MaterialCliente/Acompanhamento de projetos - Sheet1.csv")) {
  const n = r[""] ?? r["﻿"] ?? ""
  if (!/^\d{3}$/.test(n)) continue
  names.set(`0${n}`, (r.Job || "").trim())
}

// Folders in MaterialCliente that map to a single invoice without ambiguity
Object.entries({
  "0100": "Mastercard Messi Comfy",
  "0101": "Mastercard Messi",
  "0085": "Pepsi Vini",
}).forEach(([seq, name]) => names.set(seq, name))

// ---- 2. current state ----------------------------------------------------------------------
const { data: anchors } = await sb.from("jobs").select("id, name, client_id, currency").eq("user_id", uid).like("name", "Histórico %")
const anchorIds = anchors.map(a => a.id)
const { data: invoices } = await sb.from("invoices").select("id, seq_number, job_id, currency").eq("user_id", uid).in("job_id", anchorIds)
console.log(`${anchors.length} jobs-âncora, ${invoices.length} invoices a redistribuir`)
if (conflicts.length) console.log(`nomes conflitantes (ficam em branco): ${conflicts.join(" | ")}`)

// ---- 3. group into the jobs to create -------------------------------------------------------
const anchorById = new Map(anchors.map(a => [a.id, a]))
const groups = new Map()  // key -> { client_id, name, currency, invoices: [] }
let blankSeq = 0
for (const inv of invoices) {
  const anchor = anchorById.get(inv.job_id)
  const name = names.get(inv.seq_number) ?? ""
  const key = name ? `${anchor.client_id}::${name}` : `blank::${blankSeq++}`
  if (!groups.has(key)) groups.set(key, { client_id: anchor.client_id, name, currency: inv.currency, invoices: [] })
  groups.get(key).invoices.push(inv)
}

const named = [...groups.values()].filter(g => g.name)
const blank = [...groups.values()].filter(g => !g.name)
console.log(`-> ${groups.size} jobs (${named.length} com nome, ${blank.length} em branco)\n`)
for (const g of [...named].sort((a, b) => a.name.localeCompare(b.name))) {
  console.log(`  ${g.name.padEnd(34)} ${g.invoices.map(i => i.seq_number).join(", ")}`)
}
if (blank.length) console.log(`  ${"(em branco)".padEnd(34)} ${blank.map(g => g.invoices[0].seq_number).join(", ")}`)

if (dry) { console.log("\n[dry run] nada foi escrito"); process.exit(0) }

// ---- 4. apply --------------------------------------------------------------------------------
for (const g of groups.values()) {
  let jobId
  const { data: existing } = await sb.from("jobs").select("id").eq("user_id", uid).eq("client_id", g.client_id).eq("name", g.name).limit(1).maybeSingle()
  if (existing && g.name) {
    jobId = existing.id
  } else {
    const { data, error } = await sb.from("jobs").insert({
      user_id: uid, client_id: g.client_id, name: g.name, currency: g.currency, status: "completed",
      hourly_rate: 0, daily_rate: 0, is_recurring: false, tax_rate: 0,
      notes: "Importado do histórico",
    }).select("id").single()
    if (error) throw error
    jobId = data.id
  }
  const { error } = await sb.from("invoices").update({ job_id: jobId }).in("id", g.invoices.map(i => i.id))
  if (error) throw error
}

// ---- 5. drop the anchors that are now empty ---------------------------------------------------
let dropped = 0
for (const a of anchors) {
  const { count } = await sb.from("invoices").select("id", { count: "exact", head: true }).eq("job_id", a.id)
  if (count === 0) {
    const { error } = await sb.from("jobs").delete().eq("id", a.id)
    if (error) console.error("não deu pra apagar", a.name, error.message)
    else dropped++
  } else {
    console.log(`âncora mantida (${count} invoices sobraram): ${a.name}`)
  }
}
console.log(`\npronto: ${groups.size} jobs criados, ${dropped} âncoras removidas`)
