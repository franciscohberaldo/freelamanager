// scripts/import-nf-history.mjs — idempotent import of historical clients, NFs and invoices.
// Reads CSVs from MaterialCliente/ (gitignored). Run: node scripts/import-nf-history.mjs [--dry]
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

/** Minimal CSV parser; duplicate header names get a numeric suffix (e.g. "Estudio/Agencia", "Estudio/Agencia_2"). */
function csv(path) {
  const [head, ...rows] = readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean)
  const seen = new Map()
  const cols = head.split(",").map((c) => {
    const n = (seen.get(c) ?? 0) + 1
    seen.set(c, n)
    return n === 1 ? c : `${c}_${n}`
  })
  return rows.map((line) => {
    const vals = []; let cur = "", q = false
    for (const ch of line) {
      if (ch === '"') q = !q
      else if (ch === "," && !q) { vals.push(cur); cur = "" }
      else cur += ch
    }
    vals.push(cur)
    return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? "").trim()]))
  })
}
/** Parses both pt-BR ("12.000,00") and en-US ("R$19,200.00") money strings. */
function brl(s) {
  let t = String(s ?? "").replace(/[R$\s]/g, "")
  if (!t) return 0
  const lastComma = t.lastIndexOf(","), lastDot = t.lastIndexOf(".")
  if (lastComma > lastDot) t = t.replace(/\./g, "").replace(",", ".")
  else t = t.replace(/,/g, "")
  return Number(t) || 0
}
const isoFromBr = (s) => { const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null }
const isoFromUs = (s) => { const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null }

// Canonical client names (raw tomador → name)
const CANON = [
  [/videographica/i, "Videographica"], [/lobo multimidia/i, "Lobo"], [/cinemalink/i, "Cinemalink"], [/sam transmedia/i, "SAM Transmedia (Kumite)"],
  [/polis/i, "Polis Propaganda"], [/mais filmes/i, "Mais Filmes"], [/jofilsan/i, "Jofilsan"], [/capela/i, "A Capela"], [/tollmeiner|quanta/i, "Quanta"],
  [/a00/i, "A00 Produções"], [/arvore/i, "Árvore"], [/tabuleiro/i, "Tabuleiro Filmes"],
  [/deutsch|steelhead/i, "Steelhead (Deutsch)"], [/^rga$/i, "RGA"], [/invisible works/i, "Invisible Works"],
]
const canon = (raw) => (CANON.find(([re]) => re.test(raw))?.[1]) ?? raw.replace(/\s+(ltda|eireli|me|epp)\.?.*$/i, "").trim()

const stats = { clients: 0, jobs: 0, invoices: 0, skipped: 0, errors: 0 }

const clientCache = new Map()
async function upsertClient({ name, legal_name, cnpj, address, notes }) {
  if (clientCache.has(name)) return clientCache.get(name)
  const { data: ex } = await sb.from("clients").select("id, cnpj, legal_name, address").eq("user_id", uid).eq("name", name).maybeSingle()
  if (ex) {
    clientCache.set(name, ex.id)
    const patch = {}
    if (!ex.cnpj && cnpj) patch.cnpj = cnpj
    if (!ex.legal_name && legal_name) patch.legal_name = legal_name
    if (!ex.address && address) patch.address = address
    if (Object.keys(patch).length && !dry) await sb.from("clients").update(patch).eq("id", ex.id)
    return ex.id
  }
  if (dry) { console.log("[dry] client +", name, cnpj ?? ""); stats.clients++; clientCache.set(name, `dry:${name}`); return `dry:${name}` }
  const { data, error } = await sb.from("clients").insert({ user_id: uid, name, legal_name, cnpj, address, notes }).select("id").single()
  if (error) throw error
  console.log("client +", name); stats.clients++
  clientCache.set(name, data.id)
  return data.id
}

const jobCache = new Map()
async function historyJob(clientId, clientName, currency) {
  const key = `${clientId}|${currency}`
  if (jobCache.has(key)) return jobCache.get(key)
  const name = `Histórico ${clientName}`
  const { data: ex } = String(clientId).startsWith("dry:") ? { data: null } :
    await sb.from("jobs").select("id").eq("user_id", uid).eq("client_id", clientId).eq("name", name).maybeSingle()
  if (ex) { jobCache.set(key, ex.id); return ex.id }
  if (dry) { console.log("[dry] job +", name, currency); stats.jobs++; jobCache.set(key, `dry:${name}`); return `dry:${name}` }
  const { data, error } = await sb.from("jobs").insert({
    user_id: uid, client_id: clientId, name, currency, status: "completed", hourly_rate: 0, daily_rate: 0,
    is_recurring: false, tax_rate: 0, notes: "Job de ancoragem para invoices importadas",
  }).select("id").single()
  if (error) throw error
  stats.jobs++; jobCache.set(key, data.id)
  return data.id
}

const seenSeq = new Set()
async function insertInvoice(row) {
  if (seenSeq.has(row.seq_number)) { console.log("skip (duplicate in source)", row.seq_number); stats.skipped++; return }
  seenSeq.add(row.seq_number)
  const { data: ex } = await sb.from("invoices").select("id").eq("user_id", uid).eq("seq_number", row.seq_number).maybeSingle()
  if (ex) { console.log("skip (exists)", row.seq_number); stats.skipped++; return }
  if (dry) { console.log("[dry] invoice +", row.seq_number, row.currency, row.total); stats.invoices++; return }
  const { error } = await sb.from("invoices").insert({ user_id: uid, status: "paid", ...row })
  if (error) { console.error("ERR", row.seq_number, error.message); stats.errors++ }
  else { console.log("invoice +", row.seq_number); stats.invoices++ }
}

// 1) Paulínia NFs (series "paulinia"), seq prefixed NFP so they never collide with the invoice sequence
for (const r of csv("MaterialCliente/nf_historico_paulinia.csv").filter((r) => r.tipo === "nfse" && r.nf)) {
  const name = canon(r.tomador)
  const cid = await upsertClient({ name, legal_name: r.tomador, cnpj: r.cnpj_tomador || null, address: null, notes: "Imported from NF history (Paulínia)" })
  const jid = await historyJob(cid, name, "BRL")
  const date = isoFromBr(r.data) ?? "2016-01-01"
  const nf = r.nf.padStart(3, "0")
  await insertInvoice({
    job_id: jid, invoice_number: `H-NFP${nf}`, seq_number: `NFP${nf}`,
    period_start: date, period_end: date, total_hours_billed: 0, subtotal: brl(r.valor), tax_rate: 0, tax_amount: 0, total: brl(r.valor),
    currency: "BRL", nf_status: "sent", nf_series: "paulinia", nf_number: r.nf, nf_issued_at: date, nf_amount_brl: brl(r.valor),
    sent_at: date, paid_at: date, notes: r.descricao || null,
  })
}

// 2) International invoices read from the PDFs: [seq, date, client, currency, total, po]
const INTL = [
  ["0006", "2022-07-01", "State Design", "USD", null, null], ["0007", "2022-07-15", "State Design", "USD", null, null], ["0008", "2022-08-03", "State Design", "USD", null, null],
  ["0009", "2022-08-26", "State Design", "USD", null, null], ["0010", "2022-09-02", "Firegrader", "USD", null, null], ["0011", "2022-09-27", "Steelhead (Deutsch)", "USD", null, "4701732399"],
  ["0012", "2022-10-17", "Firegrader", "USD", null, null], ["0048", "2022-11-11", "Tuzuu", "BRL", null, null], ["0049", "2022-11-15", "Steelhead (Deutsch)", "USD", null, "4701751173"],
  ["0050", "2022-12-15", "State Design", "USD", null, null], ["0051", "2023-01-03", "Joy", "USD", null, null], ["0052", "2023-04-24", "State Design", "USD", null, null],
  ["0053", "2023-05-30", "Steelhead (Deutsch)", "USD", null, "4701751173"], ["0054", "2023-08-11", "RGA", "USD", 2000, null],
  ["0079", "2024-11-01", "Steelhead (Deutsch)", "USD", 5400, null], ["0080", "2024-11-01", "Steelhead (Deutsch)", "USD", 1800, null],
  ["0089", "2025-05-08", "Steelhead (Deutsch)", "USD", 7000, "4702134214"], ["0100", "2025-04-10", "Lobo", "BRL", 19200, null], ["0101", "2025-04-10", "Lobo", "BRL", 19200, null],
]
for (const [seq, date, client, currency, total, po] of INTL) {
  const cid = await upsertClient({ name: client, legal_name: null, cnpj: null, address: null, notes: "Imported from invoice history" })
  const jid = await historyJob(cid, client, currency)
  await insertInvoice({
    job_id: jid, invoice_number: `H-${seq}`, seq_number: seq, po_number: po, period_start: date, period_end: date, total_hours_billed: 0,
    subtotal: total ?? 0, tax_rate: 0, tax_amount: 0, total: total ?? 0, currency, sent_at: date, paid_at: date,
    nf_status: currency === "BRL" ? "issued" : "not_required", nf_amount_brl: currency === "BRL" ? total : null,
    notes: total == null ? "Amount not read from the PDF; fill in" : null,
  })
}

// 3) 2025 spreadsheet rows 083–088 (first header cell is empty → key "")
for (const r of csv("MaterialCliente/Acompanhamento de projetos - Sheet1.csv").filter((r) => /^\d{3}$/.test(r[""] ?? ""))) {
  const seq = `0${r[""]}`
  const rawClient = r["Estudio/Agencia"] || "Desconhecido"
  const intermediary = r["Estudio/Agencia_2"] || null
  const name = canon(rawClient)
  const cnpj = r.CNPJ || null
  const foreign = !cnpj && /deutsch|steelhead|rga/i.test(rawClient)
  const currency = foreign ? "USD" : "BRL"
  const cid = await upsertClient({ name, legal_name: cnpj ? rawClient : null, cnpj, address: r["Endereço"] || null, notes: null })
  const jid = await historyJob(cid, name, currency)
  const issued = isoFromUs(r["Emissão da NF"])
  const start = isoFromUs(r["Início Job"]) ?? issued ?? "2025-01-01"
  const value = brl(r.Valor)
  await insertInvoice({
    job_id: jid, invoice_number: `H-${seq}`, seq_number: seq, period_start: start, period_end: issued ?? start, total_hours_billed: 0,
    subtotal: value, tax_rate: 0, tax_amount: 0, total: value, currency,
    nf_status: foreign ? "not_required" : (issued ? "issued" : "pending"),
    nf_series: issued ? "sao_paulo" : null, nf_issued_at: issued, nf_amount_brl: !foreign && value ? value : null,
    notes: [intermediary && `Via: ${intermediary}`, r.Cliente && `End client: ${r.Cliente}`, r.Job && `Job: ${r.Job}`, r["Descrição do Job"], !value && "Amount not provided; fill in"]
      .filter(Boolean).join(" · ") || null,
  })
}

console.log("done", dry ? "(dry run)" : "", JSON.stringify(stats))
