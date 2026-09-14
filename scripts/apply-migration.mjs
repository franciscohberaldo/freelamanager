// scripts/apply-migration.mjs — runs a .sql file against the Supabase Postgres.
// Usage: node scripts/apply-migration.mjs supabase/migrations/017_job_thumbnails.sql
//
// There is no Supabase CLI in this project; migrations are applied with this, using
// SUPABASE_DB_PASSWORD from .env.local. The whole file runs inside one transaction,
// so a failing statement leaves the database untouched.
import { readFileSync } from "node:fs"
import pg from "pg"

const file = process.argv[2]
if (!file) { console.error("informe o arquivo .sql"); process.exit(1) }

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.trim().startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] }))
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
const password = encodeURIComponent(env.SUPABASE_DB_PASSWORD)

// The direct host is IPv6-only on newer projects, so fall back to the pooler.
const candidates = [
  `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`,
  ...["us-east-1", "us-east-2", "us-west-1", "sa-east-1", "eu-central-1", "eu-west-1", "ap-southeast-1"]
    .map(r => `postgresql://postgres.${ref}:${password}@aws-0-${r}.pooler.supabase.com:5432/postgres`),
]

const sql = readFileSync(file, "utf8")
const redact = s => s.replace(password, "***")

for (const url of candidates) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 })
  try {
    await client.connect()
  } catch (e) {
    console.log(`sem conexão em ${redact(url).replace(/postgresql:\/\/[^@]+@/, "")}: ${e.message.split("\n")[0]}`)
    try { await client.end() } catch {}
    continue
  }
  console.log(`conectado em ${redact(url).replace(/postgresql:\/\/[^@]+@/, "")}`)
  try {
    await client.query("begin")
    await client.query(sql)
    await client.query("commit")
    console.log(`aplicado: ${file}`)
  } catch (e) {
    await client.query("rollback").catch(() => {})
    console.error(`FALHOU (nada foi escrito): ${e.message}`)
    process.exitCode = 1
  } finally {
    await client.end()
  }
  process.exit(process.exitCode ?? 0)
}

console.error("não consegui conectar em nenhum host")
process.exit(1)
