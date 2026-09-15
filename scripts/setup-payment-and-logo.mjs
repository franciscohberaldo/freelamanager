// One-off: upload the logo extracted from the user's own model invoice, fill the
// international payment fields from that same document, and backfill invoice_items
// from daily_logs for invoices that have none.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }),
)
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const db = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
})
await db.connect()

const { rows: [settings] } = await db.query("select user_id from user_settings limit 1")
const uid = settings.user_id
console.log("user:", uid)

// ── 1. logo ──────────────────────────────────────────────────────────────────
const logoBytes = readFileSync(".bg-shell/logo-final.png")
const logoPath = `${uid}/logo-monograma.png`
const { error: upErr } = await supabase.storage
  .from("job-thumbnails")
  .upload(logoPath, logoBytes, { upsert: true, contentType: "image/png" })
if (upErr) throw upErr
const { data: pub } = supabase.storage.from("job-thumbnails").getPublicUrl(logoPath)
console.log("logo:", pub.publicUrl)

// ── 2. settings: os dados do próprio invoice modelo do usuário ───────────────
await db.query(
  `update user_settings set
     logo_url = $1,
     invoice_contact_email = 'hello@chico.cx',
     invoice_contact_phone = '+55 (11) 976.947.533',
     intermediary_bank_name = 'JP Morgan Chase N.A.',
     intermediary_bank_swift = 'CHASUS33',
     intermediary_bank_aba = '021000021',
     intermediary_bank_account = '360556937',
     intermediary_bank_address = '270 Park Avenue, New York, NY, 10017, United States',
     bank_name = 'Banco Inter S.A.',
     bank_swift = 'ITEMBRSP',
     bank_beneficiary = 'ESTUDIO JUDITE EIRELI',
     bank_iban = 'BR9800416968000010241887640C1',
     bank_address = '1219 Barbacena Ave, Belo Horizonte, MG, 30190-924, Brazil'
   where user_id = $2`,
  [pub.publicUrl, uid],
)
console.log("settings atualizadas")

// ── 3. backfill de itens: invoices sem nenhum item ───────────────────────────
const { rows: empties } = await db.query(`
  select i.*, j.billing_mode, j.hourly_rate, j.daily_rate, j.contract_value, j.name as job_name
  from invoices i
  join jobs j on j.id = i.job_id
  where not exists (select 1 from invoice_items ii where ii.invoice_id = i.id)
  order by i.created_at
`)
console.log("invoices sem itens:", empties.length)

for (const inv of empties) {
  const mode = inv.billing_mode ?? "hourly"
  let items = []
  if (mode === "fixed") {
    const value = Number(inv.contract_value ?? inv.subtotal ?? 0)
    items = [{
      invoice_id: inv.id, log_id: null, date: inv.period_end, description: inv.job_name,
      hours_billed: Number(inv.total_hours_billed ?? 0), quantity: 1, unit: "project",
      rate: value, subtotal: value,
    }]
  } else {
    const { rows: logs } = await db.query(
      `select * from daily_logs where job_id = $1 and date >= $2 and date <= $3 order by date`,
      [inv.job_id, inv.period_start, inv.period_end],
    )
    const toDays = h => Number((h / 8).toFixed(2))
    items = logs.map(l => ({
      invoice_id: inv.id, log_id: l.id, date: l.date,
      hours_billed: Number(l.hours_billed),
      quantity: mode === "daily" ? toDays(Number(l.hours_billed)) : Number(l.hours_billed),
      unit: mode === "daily" ? "day" : "hour",
      rate: mode === "daily" ? Number(inv.daily_rate ?? 0) : Number(inv.hourly_rate ?? 0),
      subtotal: Number(l.total_value ?? 0),
    }))
  }
  if (!items.length) { console.log(`  ${inv.invoice_number}: sem logs no período, pulando`); continue }
  for (const item of items) await db.query(
    `insert into invoice_items (invoice_id, log_id, date, description, hours_billed, quantity, unit, rate, subtotal)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [item.invoice_id, item.log_id, item.date, item.description ?? null, item.hours_billed, item.quantity, item.unit, item.rate, item.subtotal],
  )
  console.log(`  ${inv.invoice_number}: ${items.length} itens (${mode})`)
}

await db.end()
console.log("pronto")
