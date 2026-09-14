// scripts/backfill-job-brands.mjs — idempotent. Run: node scripts/backfill-job-brands.mjs [--dry]
//
// Fills jobs.end_client (the brand served through the tomador) for the historical jobs whose
// source material actually records it: the tracking spreadsheet has a "Cliente" column separate
// from "Job". Names recovered from NF filenames mix brand and piece, so those are left alone.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users } = await sb.auth.admin.listUsers()
const uid = users.users.find(u => u.email === "franciscohberaldo@gmail.com").id

function csv(path) {
  const [head, ...rows] = readFileSync(path, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter(Boolean)
  const cols = head.split(",")
  return rows.map(line => {
    const vals = []; let cur = "", q = false
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { vals.push(cur); cur = "" } else cur += ch }
    vals.push(cur); return Object.fromEntries(cols.map((c, i) => [c, (vals[i] ?? "").trim()]))
  })
}

// seq_number -> brand, from the spreadsheet's own "Cliente" column
const brands = new Map()
for (const r of csv("MaterialCliente/Acompanhamento de projetos - Sheet1.csv")) {
  const n = r[""] ?? r["﻿"] ?? ""
  if (!/^\d{3}$/.test(n)) continue
  const brand = (r.Cliente || "").trim()
  if (brand) brands.set(`0${n}`, brand)
}
console.log(`planilha traz marca para ${brands.size} invoices: ${[...brands].map(([s, b]) => `${s}=${b}`).join(", ")}`)

const { data: invoices } = await sb.from("invoices").select("seq_number, job_id").eq("user_id", uid).in("seq_number", [...brands.keys()])
const { data: jobs } = await sb.from("jobs").select("id, name, end_client").eq("user_id", uid)
const jobById = new Map(jobs.map(j => [j.id, j]))

let changed = 0, skipped = 0
for (const inv of invoices ?? []) {
  const job = jobById.get(inv.job_id)
  const brand = brands.get(inv.seq_number)
  if (!job || !brand) continue
  if (job.end_client) { console.log(`já preenchido: ${job.name} = ${job.end_client}`); skipped++; continue }
  console.log(`${dry ? "[dry] " : ""}${inv.seq_number}: job "${job.name}" -> marca "${brand}"`)
  if (!dry) {
    const { error } = await sb.from("jobs").update({ end_client: brand }).eq("id", job.id)
    if (error) { console.error("ERRO", job.name, error.message); continue }
  }
  jobById.set(job.id, { ...job, end_client: brand })   // a job covering two invoices is written once
  changed++
}
console.log(`\n${dry ? "[dry run] " : ""}${changed} jobs com marca preenchida, ${skipped} já tinham`)
