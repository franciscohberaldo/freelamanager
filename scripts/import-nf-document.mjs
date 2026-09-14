// scripts/import-nf-document.mjs — files one issued NFS-e: the client's fiscal data, the
// job, the invoice, and the PDF itself in the job's "NF emitida" slot.
//
// Usage: node scripts/import-nf-document.mjs [--dry]
//
// Written for NFS-e 00000090 (R/GA, 27/10/2025). The NF data sits in NF below; point it at
// another note by editing that block. Re-running is safe: every write is keyed on something
// stable (CNPJ, PO number, NF number, storage path), so a second run updates instead of
// duplicating.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const DRY = process.argv.includes("--dry")

const NF = {
  pdf:        "MaterialCliente/260914/251027_NFE_0090_RGA_MotionDesign.pdf",
  number:     "0090",
  series:     "sao_paulo",
  issuedAt:   "2025-10-27",
  total:      17250,
  currency:   "BRL",
  serviceCode: "02496",
  po:         "42",
  service:    "Motion Design",
  periodStart: "2025-10-01",
  periodEnd:   "2025-10-27",
  paid:       true,
  client: {
    match:      { name: "RGA" },
    legal_name: "R/GA MEDIA GROUP PUBLICIDADE LTDA.",
    cnpj:       "39.937.180/0001-78",
    address:    "AV MANUEL BANDEIRA 360, GALPAO PARTE GP STATE - VILA LEOPOLDINA - CEP: 05317-020 - São Paulo/SP",
    email:      "financeiro@rga.com",
    im:         "4.181.670-6",
  },
  provider: {
    legal_name:             "ESTUDIO JUDITE EIRELI",
    municipal_registration: "6.437.727-0",
    fiscal_address:         "R COLONIA DA GLORIA 00453, AP 192 - VILA MARIANA - CEP: 04113-001 - São Paulo/SP",
  },
}

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const say = (step, detail) => console.log(`${DRY ? "[dry] " : ""}${step}: ${detail}`)
const die = (step, error) => { console.error(`FALHOU em ${step}: ${error.message}`); process.exit(1) }

// ── Whose data is this? ──────────────────────────────────────────────────────
const { data: client, error: clientErr } = await db
  .from("clients").select("id, user_id, name, notes").eq("name", NF.client.match.name).maybeSingle()
if (clientErr) die("buscar cliente", clientErr)
if (!client) die("buscar cliente", new Error(`cliente ${NF.client.match.name} não existe`))
const userId = client.user_id
say("cliente", `${client.name} (${client.id})`)

// ── 1. The client's fiscal identity, straight off the note ───────────────────
const clientPatch = {
  legal_name: NF.client.legal_name,
  cnpj:       NF.client.cnpj,
  address:    NF.client.address,
  email:      NF.client.email,
  notes: [client.notes, `Inscrição municipal: ${NF.client.im}`]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("\n"),
}
if (!DRY) {
  const { error } = await db.from("clients").update(clientPatch).eq("id", client.id)
  if (error) die("atualizar cliente", error)
}
say("cliente atualizado", `${clientPatch.legal_name} · ${clientPatch.cnpj}`)

// ── 2. The provider's own fiscal settings, also on the note ──────────────────
if (!DRY) {
  const { error } = await db.from("user_settings")
    .update(NF.provider).eq("user_id", userId)
  if (error) die("atualizar user_settings", error)
}
say("dados fiscais", `${NF.provider.legal_name} · IM ${NF.provider.municipal_registration}`)

// ── 3. The job. Keyed on (client, PO) so a re-run finds the same one ─────────
const { data: existingJob, error: jobFindErr } = await db.from("jobs")
  .select("id, name").eq("client_id", client.id).eq("po_number", NF.po).maybeSingle()
if (jobFindErr) die("buscar job", jobFindErr)

const jobPayload = {
  user_id: userId, client_id: client.id,
  name: NF.service, po_number: NF.po, nf_description: NF.service,
  currency: NF.currency, status: "completed", billing_mode: "hourly",
  hourly_rate: 0, daily_rate: 0, tax_rate: 0, is_recurring: false, is_confidential: false,
  start_date: NF.periodStart, end_date: NF.periodEnd,
  contract_value: NF.total,
  notes: `Cadastrado a partir da NFS-e ${NF.number} de ${NF.issuedAt}.`,
}

let jobId = existingJob?.id
if (!DRY) {
  if (jobId) {
    const { error } = await db.from("jobs").update(jobPayload).eq("id", jobId)
    if (error) die("atualizar job", error)
  } else {
    const { data, error } = await db.from("jobs").insert(jobPayload).select("id").single()
    if (error) die("criar job", error)
    jobId = data.id
  }
}
say(existingJob ? "job atualizado" : "job criado", `${jobPayload.name} · PO ${NF.po} · ${jobId ?? "(dry)"}`)

// ── 4. The invoice carrying the NF ───────────────────────────────────────────
const { data: existingInv, error: invFindErr } = await db.from("invoices")
  .select("id").eq("user_id", userId).eq("nf_series", NF.series).eq("nf_number", NF.number).maybeSingle()
if (invFindErr) die("buscar invoice", invFindErr)

const invoicePayload = {
  user_id: userId, job_id: jobId,
  invoice_number: `H-${NF.number}`, seq_number: NF.number,
  period_start: NF.periodStart, period_end: NF.periodEnd,
  total_hours_billed: 0,
  subtotal: NF.total, tax_rate: 0, tax_amount: 0, total: NF.total, currency: NF.currency,
  status: NF.paid ? "paid" : "sent",
  nf_status: "issued", nf_series: NF.series, nf_number: NF.number,
  nf_issued_at: NF.issuedAt, nf_amount_brl: NF.total,
  po_number: NF.po,
  notes: `Serviços prestados de ${NF.service} · código do serviço ${NF.serviceCode} · NFS-e ${NF.number}`,
}

let invoiceId = existingInv?.id
if (!DRY) {
  if (invoiceId) {
    const { error } = await db.from("invoices").update(invoicePayload).eq("id", invoiceId)
    if (error) die("atualizar invoice", error)
  } else {
    const { data, error } = await db.from("invoices").insert(invoicePayload).select("id").single()
    if (error) die("criar invoice", error)
    invoiceId = data.id
  }
}
say(existingInv ? "invoice atualizada" : "invoice criada",
  `${invoicePayload.seq_number} · NF ${NF.number} · ${NF.currency} ${NF.total} · ${invoicePayload.status}`)

// ── 5. The PDF itself, in the job's "NF emitida" slot ────────────────────────
const pdf = readFileSync(NF.pdf)
const path = `${userId}/${jobId}/nf.pdf`
const fileName = NF.pdf.split("/").pop()

if (!DRY) {
  const up = await db.storage.from("job-documents")
    .upload(path, pdf, { upsert: true, contentType: "application/pdf" })
  if (up.error) die("subir PDF", up.error)

  const { error } = await db.from("job_documents").upsert({
    user_id: userId, job_id: jobId, kind: "nf",
    path, file_name: fileName, mime_type: "application/pdf", size_bytes: pdf.length,
  }, { onConflict: "job_id,kind" })
  if (error) die("registrar documento", error)
}
say("PDF anexado", `${fileName} (${(pdf.length / 1024).toFixed(0)} KB) em ${path}`)

console.log(DRY ? "\nnada foi gravado (--dry)" : `\npronto — /jobs/${jobId}`)
