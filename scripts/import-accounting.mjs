// scripts/import-accounting.mjs — files the monthly accounting PDFs in MaterialCliente
// under the competência they refer to.
//
// Usage: node --experimental-strip-types scripts/import-accounting.mjs [--dry] [--verbose]
//
// The flag lets it import the app's own classifier, so the script and the screen agree on
// what a file is and which month it belongs to.
//
// Safe to re-run: a file already stored under the same competência and kind, with the same
// bytes, is left alone.
import { readdirSync, readFileSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  kindFromName, competenciaFromName, accountingPath, ACCOUNTING_LABELS, ACCOUNTING_BUCKET,
} from "../src/lib/accounting-documents.ts"

const DRY = process.argv.includes("--dry")
const VERBOSE = process.argv.includes("--verbose")

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: users } = await db.auth.admin.listUsers()
const userId = users.users[0].id

const files = []
;(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name !== "desktop.ini") files.push(p.replace(/\\/g, "/"))
  }
})("MaterialCliente")

// ── Classify ────────────────────────────────────────────────────────────────
const plan = []
const skipped = { noKind: [], noCompetencia: [], duplicate: [] }
const seen = new Set()

for (const path of files) {
  if (!/\.(pdf|png|jpe?g)$/i.test(path)) continue
  const base = path.split("/").pop()
  const dir = path.slice(0, path.lastIndexOf("/"))

  const kind = kindFromName(base)
  if (!kind) { skipped.noKind.push(path); continue }

  const hit = competenciaFromName(base, dir)
  if (!hit) { skipped.noCompetencia.push({ path, kind }); continue }

  const bytes = readFileSync(path)
  const hash = createHash("sha1").update(bytes).digest("hex")
  const dedupe = `${hit.competencia}:${kind}:${hash}`
  if (seen.has(dedupe)) { skipped.duplicate.push({ path, why: "cópia idêntica na mesma competência" }); continue }
  seen.add(dedupe)

  plan.push({ path, base, kind, bytes, hash, ...hit })
}

// ── Report ──────────────────────────────────────────────────────────────────
const byKind = {}
const byFrom = {}
for (const e of plan) {
  byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  byFrom[e.from] = (byFrom[e.from] ?? 0) + 1
}
console.log(`${plan.length} documentos para a contabilidade ${JSON.stringify(byKind)}`)
console.log(`competência lida do ${JSON.stringify(byFrom)}\n`)

const months = [...new Set(plan.map(e => e.competencia))].sort()
console.log(`${months.length} competências, de ${months[0]} a ${months[months.length - 1]}`)

if (VERBOSE) {
  for (const e of [...plan].sort((a, b) => a.competencia.localeCompare(b.competencia))) {
    console.log(`  ${e.competencia} [${ACCOUNTING_LABELS[e.kind]}] ${e.base}  (${e.from})`)
  }
}

console.log(`\nFORA — ${skipped.noKind.length} sem tipo de contabilidade (invoices, NFs, docs da empresa)`)
console.log(`FORA — ${skipped.noCompetencia.length} com tipo mas sem competência legível:`)
for (const s of skipped.noCompetencia) console.log(`  [${s.kind}] ${s.path}`)
console.log(`\nCÓPIAS IDÊNTICAS ignoradas — ${skipped.duplicate.length}`)
for (const s of skipped.duplicate) console.log(`  ${s.path}`)

// ── Upload ──────────────────────────────────────────────────────────────────
if (DRY) { console.log("\nnada foi gravado (--dry)"); process.exit(0) }

// What is already filed, so a re-run does not duplicate.
const { data: existing } = await db.from("accounting_documents")
  .select("competencia, kind, file_name, size_bytes").eq("user_id", userId)
const already = new Set((existing ?? []).map(d => `${d.competencia.slice(0, 7)}:${d.kind}:${d.file_name}:${d.size_bytes}`))

const MIME = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" }
let done = 0, kept = 0
for (const e of plan) {
  if (already.has(`${e.competencia}:${e.kind}:${e.base}:${e.bytes.length}`)) { kept++; continue }

  const ext = e.base.split(".").pop().toLowerCase()
  const path = accountingPath(userId, e.competencia, e.kind, randomUUID(), e.base)

  const up = await db.storage.from(ACCOUNTING_BUCKET)
    .upload(path, e.bytes, { upsert: true, contentType: MIME[ext] })
  if (up.error) { console.error(`FALHOU subir ${e.base}: ${up.error.message}`); process.exit(1) }

  const { error } = await db.from("accounting_documents").insert({
    user_id: userId, competencia: `${e.competencia}-01`, scope: e.scope, kind: e.kind,
    path, file_name: e.base, mime_type: MIME[ext], size_bytes: e.bytes.length,
  })
  if (error) { console.error(`FALHOU registrar ${e.base}: ${error.message}`); process.exit(1) }
  done++
}
console.log(`\n${done} documentos anexados, ${kept} já estavam lá`)
