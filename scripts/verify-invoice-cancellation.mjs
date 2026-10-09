// Integration check: all sample rows and changes are rolled back, including on failure.
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import assert from "node:assert/strict"
import pg from "pg"

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter(l => l.includes("=") && !l.trim().startsWith("#"))
  .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const db = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000,
})

try {
  await db.connect()
  await db.query("begin")
  const { rows: [job] } = await db.query("select id, user_id from jobs limit 1")
  assert.ok(job, "An existing job is required for the rollback-only fixture")
  const { rows: [invoice] } = await db.query(
    "insert into invoices (user_id, job_id, invoice_number, period_start, period_end) values ($1,$2,$3,'2026-10-09','2026-10-09') returning id",
    [job.user_id, job.id, `cancellation-check-${randomUUID()}`],
  )
  const { rows: [log] } = await db.query(
    "insert into daily_logs (user_id, job_id, date, hours_worked, hours_billed) values ($1,$2,'2026-10-09',1,1) returning id",
    [job.user_id, job.id],
  )
  await db.query("insert into invoice_items (invoice_id, log_id, date, hours_billed, rate, subtotal) values ($1,$2,'2026-10-09',1,10,10)", [invoice.id, log.id])
  await db.query("insert into invoice_payments (invoice_id, user_id, amount, paid_at) values ($1,$2,10,'2026-10-09')", [invoice.id, job.user_id])
  await db.query("update invoices set status = 'cancelled' where id = $1", [invoice.id])
  const { rows: [cancelled] } = await db.query("select status, cancelled_at from invoices where id=$1", [invoice.id])
  assert.equal(cancelled.status, "cancelled")
  assert.ok(cancelled.cancelled_at)
  for (const table of ["invoice_items", "invoice_payments"]) {
    const { rows: [result] } = await db.query(`select count(*)::int as count from ${table} where invoice_id=$1`, [invoice.id])
    assert.equal(result.count, 1, `${table} history must be preserved`)
  }
  const { rows: [billed] } = await db.query("select count(*)::int as count from invoice_items ii join invoices i on i.id=ii.invoice_id where ii.log_id=$1 and i.status <> 'cancelled'", [log.id])
  assert.equal(billed.count, 0, "The daily log must be available for a replacement invoice")
  await db.query("savepoint invalid_payment")
  await assert.rejects(db.query("insert into invoice_payments (invoice_id,user_id,amount,paid_at) values ($1,$2,1,'2026-10-09')", [invoice.id, job.user_id]), /invoice cancelada/)
  await db.query("rollback to savepoint invalid_payment")
  await db.query("savepoint invalid_reactivation")
  await assert.rejects(db.query("update invoices set status='sent' where id=$1", [invoice.id]), /reativada/)
  await db.query("rollback to savepoint invalid_reactivation")
  await db.query("update invoices set status='cancelled' where id=$1", [invoice.id])
  const { rows: [again] } = await db.query("select cancelled_at from invoices where id=$1", [invoice.id])
  assert.equal(again.cancelled_at.toISOString(), cancelled.cancelled_at.toISOString())
  console.log("PASS: cancelled status/date, preserved items/payments, released daily log, blocked payment/reactivation, idempotent cancellation")
} finally {
  await db.query("rollback").catch(() => {})
  await db.end()
}
