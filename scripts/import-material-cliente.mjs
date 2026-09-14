// scripts/import-material-cliente.mjs — files the PDFs in MaterialCliente into the job
// document slots they belong to.
//
// Usage: node scripts/import-material-cliente.mjs [--dry] [--verbose]
//
// Only files whose name identifies both an invoice and a kind of document are touched.
// Monthly accounting — DAS guides, accountant fees, bank statements — has no job to belong
// to, and is reported rather than uploaded.
//
// Safe to re-run: the storage path is derived from (job, kind), so a second pass overwrites
// the same object and upserts the same row.
import { readdirSync, readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const DRY = process.argv.includes("--dry")
const VERBOSE = process.argv.includes("--verbose")

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// ── Every file, hashed, so identical copies are recognised as one ────────────
const files = []
;(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name !== "desktop.ini") files.push(p.replace(/\\/g, "/"))
  }
})("MaterialCliente")

const docs = files
  .filter(p => /\.(pdf|png|jpe?g)$/i.test(p))
  .map(p => {
    const buf = readFileSync(p)
    return { path: p, base: p.split("/").pop(), bytes: buf, hash: createHash("sha1").update(buf).digest("hex") }
  })

// ── What kind of document is this? ───────────────────────────────────────────
// Only patterns that say so unambiguously; anything else is left for a human.
const NF_IN_NAME = /NF_?e?_?0*(\d{1,4})(?=[_ .])/i

function kindOf(base) {
  if (NF_IN_NAME.test(base)) return "nf"
  if (/PO[_ ]?\d|PO_Signed|Agreement|BidLetter|Vendor_Form/i.test(base)) return "contract"
  if (/invoice|faturamento|fechamento/i.test(base)) return "invoice"
  return null
}

// ── Which invoice does it belong to? ─────────────────────────────────────────
const { data: invoices } = await db.from("invoices")
  .select("id, user_id, job_id, seq_number, nf_number, nf_series, nf_issued_at, total, currency, jobs(name, clients(name))")

const dateInName = base => {
  const m = base.match(/(?:^|[_ ])(\d{2})(\d{2})(\d{2})(?=[_ .])/)
  return m ? `20${m[1]}-${m[2]}-${m[3]}` : null
}

/**
 * NF numbers repeat across series — Paulínia's 90 from 2017 and São Paulo's 0090 from 2025
 * both reduce to 90 — so a number alone is not an identity. The date in the file name
 * breaks the tie.
 */
function findInvoice(base, dir) {
  const nfMatch = base.match(NF_IN_NAME)
  if (nfMatch) {
    const n = Number(nfMatch[1])
    const candidates = invoices.filter(i => i.nf_number && Number(i.nf_number) === n)
    if (candidates.length === 1) return { invoice: candidates[0], why: `NF ${n}` }
    if (candidates.length > 1) {
      const year = dateInName(base)?.slice(0, 4)
      const sameYear = candidates.filter(i => i.nf_issued_at?.slice(0, 4) === year)
      if (sameYear.length === 1) return { invoice: sameYear[0], why: `NF ${n} de ${year}` }
      return { ambiguous: true, why: `NF ${n} existe em ${candidates.length} séries` }
    }
    return { missing: true, why: `NF ${n} não está no banco` }
  }

  // "Invoice0089" mid-name, "0079_..." at the start, or the folder that names the job when
  // the file itself only says "PO_Signed.pdf".
  const seqMatch = base.match(/invoice[_ ]?0*(\d{1,4})/i)
    ?? base.match(/^0*(\d{3,4})[_ ]/)
    ?? dir.match(/(?:^|\/)0*(\d{2,4})[_ ]/)
  if (seqMatch) {
    const n = Number(seqMatch[1])
    if (n > 200) return { unknown: true }          // 2201, 2409 are year-months
    const candidates = invoices.filter(i => i.seq_number && /^\d+$/.test(i.seq_number) && Number(i.seq_number) === n)
    if (candidates.length === 1) return { invoice: candidates[0], why: `invoice ${seqMatch[1]}` }
    if (candidates.length > 1) return { ambiguous: true, why: `sequência ${n} repetida` }
    return { missing: true, why: `invoice ${seqMatch[1]} não está no banco` }
  }
  return { unknown: true }
}

// ── Plan ─────────────────────────────────────────────────────────────────────
const plan = new Map()          // `${job_id}:${kind}` -> chosen file
const contested = new Map()     // slots two different documents both claim
const skipped = { noKind: [], noInvoice: [], ambiguous: [], losers: [] }

for (const d of docs) {
  const kind = kindOf(d.base)
  if (!kind) { skipped.noKind.push(d); continue }

  const dir = d.path.slice(0, d.path.lastIndexOf("/"))
  const hit = findInvoice(d.base, dir)
  if (hit.ambiguous) { skipped.ambiguous.push({ d, why: hit.why }); continue }
  if (!hit.invoice) { skipped.noInvoice.push({ d, why: hit.why ?? "o nome não identifica uma invoice" }); continue }

  const inv = hit.invoice
  const slot = `${inv.job_id}:${kind}`
  const entry = { d, kind, inv, why: hit.why, date: dateInName(d.base) ?? "" }
  const held = plan.get(slot)
  if (!held) { plan.set(slot, entry); continue }

  // Same bytes: the same document filed twice, not a conflict.
  if (held.d.hash === entry.d.hash) { skipped.losers.push({ ...entry, reason: "cópia idêntica" }); continue }
  if (contested.has(slot)) { contested.set(slot, [...contested.get(slot), entry]); continue }

  // Two different documents want one slot. Picking one would be arbitrary and would file
  // the wrong NF against the job, so the slot is abandoned and both are reported.
  contested.set(slot, [...(contested.get(slot) ?? [held]), entry])
  plan.delete(slot)
}

for (const [slot, entries] of contested) {
  plan.delete(slot)
  for (const e of entries) skipped.losers.push({ ...e, reason: "slot disputado" })
}

// ── Report ───────────────────────────────────────────────────────────────────
const byKind = {}
for (const e of plan.values()) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
console.log(`${docs.length} PDFs/imagens · ${plan.size} vão para um slot ${JSON.stringify(byKind)}\n`)

if (VERBOSE) {
  console.log("=== PLANO ===")
  for (const e of [...plan.values()].sort((a, b) => a.d.base.localeCompare(b.d.base))) {
    console.log(`  [${e.kind}] ${e.d.base}`)
    console.log(`        → ${e.inv.jobs?.clients?.name ?? "?"} / ${e.inv.jobs?.name || "(job sem nome)"} · ${e.why}`)
  }
  console.log()
}

console.log(`FORA — ${skipped.noKind.length} sem tipo reconhecível (contabilidade mensal, docs da empresa)`)
if (VERBOSE) for (const d of skipped.noKind) console.log(`  ${d.path}`)

console.log(`\nFORA — ${skipped.noInvoice.length} com tipo mas sem invoice correspondente:`)
for (const s of skipped.noInvoice) console.log(`  ${s.d.base} — ${s.why}`)

console.log(`\nFORA — ${skipped.ambiguous.length} ambíguos:`)
for (const s of skipped.ambiguous) console.log(`  ${s.d.base} — ${s.why}`)

const identical = skipped.losers.filter(s => s.reason === "cópia idêntica")
const displaced = skipped.losers.filter(s => s.reason !== "cópia idêntica")
    .sort((a, b) => (a.inv.jobs?.name ?? "").localeCompare(b.inv.jobs?.name ?? "") || a.d.base.localeCompare(b.d.base))
console.log(`\nCÓPIAS IDÊNTICAS ignoradas — ${identical.length}:`)
for (const s of identical) console.log(`  ${s.d.base}`)

console.log(`\nPERDIDOS POR DISPUTA DE SLOT — ${displaced.length} documentos distintos que não cabem:`)
for (const s of displaced) console.log(`  ${s.d.base}\n     ${s.reason}`)

// ── Upload ───────────────────────────────────────────────────────────────────
if (DRY) { console.log("\nnada foi gravado (--dry)"); process.exit(0) }

const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" }
let done = 0
for (const e of plan.values()) {
  const ext = e.d.base.split(".").pop().toLowerCase()
  const path = `${e.inv.user_id}/${e.inv.job_id}/${e.kind}.${ext === "jpeg" ? "jpg" : ext}`

  const up = await db.storage.from("job-documents")
    .upload(path, e.d.bytes, { upsert: true, contentType: MIME[ext] })
  if (up.error) { console.error(`FALHOU subir ${e.d.base}: ${up.error.message}`); process.exit(1) }

  const { error } = await db.from("job_documents").upsert({
    user_id: e.inv.user_id, job_id: e.inv.job_id, kind: e.kind,
    path, file_name: e.d.base, mime_type: MIME[ext], size_bytes: e.d.bytes.length,
  }, { onConflict: "job_id,kind" })
  if (error) { console.error(`FALHOU registrar ${e.d.base}: ${error.message}`); process.exit(1) }
  done++
}
console.log(`\n${done} documentos anexados`)
