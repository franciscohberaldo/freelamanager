// scripts/import-orphan-docs.mjs — gives a home to job paperwork whose invoice is not in
// the database.
//
// Usage: node scripts/import-orphan-docs.mjs [--dry]
//
// Each file gets its own placeholder job, status "proposal", named after whatever the file
// name reveals. They show up in the history so they can be renamed and grouped later; one
// job per file rather than one shared bucket, because a job holds one document per kind.
//
// Safe to re-run: a placeholder is found again by its name, so a second pass updates it.
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { createClient } from "@supabase/supabase-js"

const DRY = process.argv.includes("--dry")
const PREFIX = "Sem especificação"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: users } = await db.auth.admin.listUsers()
const userId = users.users[0].id

// The files the job import could not place, listed explicitly: this is a one-off cleanup of
// a known set, not a rule that should keep firing on whatever lands in the folder.
const ORPHANS = [
  ["Deutsch IC Agreement v2_Francisco Beraldo 5.6.25.pdf", "contract", "Deutsch — IC Agreement"],
  ["PO_Signed.pdf", "contract", "Deutsch/Verizon — PO assinada"],
  ["0002_2202_Vanpaio_247Office Invoice.pdf", "invoice", "Vanpaio — 247Office (invoice 0002)"],
  ["01_STATE_Vendor_Form._EstudioJudite.pdf", "contract", "State Design — vendor form"],
  ["01_STATE_Vendor_Form_2022_intermediarybank.pdf", "contract", "State Design — vendor form (banco intermediário)"],
  ["221111_NFe48_Tuzuu_Braskem_v01.pdf", "nf", "Tuzuu — Braskem (NF 48)"],
  ["20200707_NFE_012_fpsfilmes_totvs_painelfinanceiroRefacao.pdf", "nf", "FPS Filmes — Totvs painel financeiro (NF 12)"],
  ["2111_AQKA_NIKE SB x GUNDAM - NEWTYPE JAM_INVOICE.pdf", "invoice", "AQKA — Nike SB x Gundam"],
  ["2201_KingUrsa_Shopify Invoice.pdf", "invoice", "King Ursa — Shopify"],
  ["220513_State_Invoice.pdf", "invoice", "State Design — invoice 05/2022"],
  ["PO_4702035804_signed.pdf", "contract", "Steelhead — PO 4702035804"],
  ["PO_4702046993_signed.pdf", "contract", "Steelhead — PO 4702046993"],
  ["NF0001_191118_FPSProducoes_Totvs_BigNumbers.pdf", "nf", "FPS Produções — Totvs Big Numbers (NF 1)"],
  ["NF0004_XXXXXXX.pdf", "nf", "NF 4 — origem desconhecida"],
  ["PO_4701732399 (1).pdf", "contract", "Steelhead — PO 4701732399"],
  ["PO_4701751173.pdf", "contract", "Steelhead — PO 4701751173"],
]

// Find each file wherever it sits in the tree.
const found = new Map()
;(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p)
    else if (!found.has(e.name)) found.set(e.name, p.replace(/\\/g, "/"))
  }
})("MaterialCliente")

// A placeholder needs a client; the ones with no clue get a catch-all.
const { data: clients } = await db.from("clients").select("id, name")
const clientFor = label => {
  const hit = clients.find(c => label.toLowerCase().startsWith(c.name.toLowerCase().slice(0, 6)))
  return hit?.id ?? null
}
const fallbackClient = clients[0]?.id
if (!fallbackClient) { console.error("nenhum cliente no banco"); process.exit(1) }

let created = 0, updated = 0, missing = []
for (const [fileName, kind, label] of ORPHANS) {
  const path = found.get(fileName)
  if (!path) { missing.push(fileName); continue }

  const jobName = `${PREFIX} — ${label}`
  const bytes = readFileSync(path)

  const { data: existing } = await db.from("jobs")
    .select("id").eq("user_id", userId).eq("name", jobName).maybeSingle()

  const payload = {
    user_id: userId,
    client_id: clientFor(label) ?? fallbackClient,
    name: jobName,
    status: "proposal",
    currency: "BRL", billing_mode: "hourly",
    hourly_rate: 0, daily_rate: 0, tax_rate: 0,
    is_recurring: false, is_confidential: false,
    notes: `Placeholder criado do arquivo ${fileName}. Falta identificar cliente, job e invoice.`,
  }

  let jobId = existing?.id
  if (!DRY) {
    if (jobId) {
      const { error } = await db.from("jobs").update(payload).eq("id", jobId)
      if (error) { console.error(`FALHOU atualizar ${jobName}: ${error.message}`); process.exit(1) }
      updated++
    } else {
      const { data, error } = await db.from("jobs").insert(payload).select("id").single()
      if (error) { console.error(`FALHOU criar ${jobName}: ${error.message}`); process.exit(1) }
      jobId = data.id
      created++
    }

    const ext = fileName.split(".").pop().toLowerCase()
    const storePath = `${userId}/${jobId}/${kind}.${ext}`
    const up = await db.storage.from("job-documents")
      .upload(storePath, bytes, { upsert: true, contentType: "application/pdf" })
    if (up.error) { console.error(`FALHOU subir ${fileName}: ${up.error.message}`); process.exit(1) }

    const { error } = await db.from("job_documents").upsert({
      user_id: userId, job_id: jobId, kind,
      path: storePath, file_name: fileName, mime_type: "application/pdf", size_bytes: bytes.length,
    }, { onConflict: "job_id,kind" })
    if (error) { console.error(`FALHOU registrar ${fileName}: ${error.message}`); process.exit(1) }
  } else {
    existing ? updated++ : created++
  }

  console.log(`${DRY ? "[dry] " : ""}${existing ? "atualizado" : "criado"}: ${jobName}  [${kind}] ${fileName}`)
}

console.log(`\n${created} placeholders criados, ${updated} atualizados`)
if (missing.length) console.log(`arquivos não encontrados: ${missing.join(", ")}`)
if (DRY) console.log("nada foi gravado (--dry)")
