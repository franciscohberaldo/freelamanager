// scripts/normalize-names.mjs — quiets down names stored in capitals.
//
// Usage: node --experimental-strip-types scripts/normalize-names.mjs [--dry]
//
// The --experimental-strip-types flag is what lets this import the same normaliser the app
// uses, rather than keeping a second copy of the rules that could drift from it.
//
// Safe to re-run: normalizeName leaves alone anything that is not shouting, so a second
// pass finds nothing to do.
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"
import { normalizeName } from "../src/lib/text-case.ts"

const DRY = process.argv.includes("--dry")

/** Only the name-shaped columns. Addresses and free text are left as they came. */
const TARGETS = [
  ["clients", ["name", "company", "legal_name", "billing_entity"]],
  ["jobs", ["name"]],
]

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter(l => l.includes("=") && !l.trim().startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let changed = 0
let untouched = 0

for (const [table, cols] of TARGETS) {
  const { data, error } = await db.from(table).select(["id", ...cols].join(", "))
  if (error) { console.error(`FALHOU ao ler ${table}: ${error.message}`); process.exit(1) }

  for (const row of data ?? []) {
    const patch = {}
    for (const col of cols) {
      const next = normalizeName(row[col])
      if (next !== row[col]) patch[col] = next
    }
    if (Object.keys(patch).length === 0) { untouched++; continue }

    for (const [col, next] of Object.entries(patch)) {
      console.log(`${table}.${col}`)
      console.log(`   antes:  ${JSON.stringify(row[col])}`)
      console.log(`   depois: ${JSON.stringify(next)}`)
    }
    changed++

    if (!DRY) {
      const { error: upErr } = await db.from(table).update(patch).eq("id", row.id)
      if (upErr) { console.error(`FALHOU ao gravar ${table} ${row.id}: ${upErr.message}`); process.exit(1) }
    }
  }
}

console.log(`\n${changed} linhas ${DRY ? "seriam alteradas" : "alteradas"}, ${untouched} intactas`)
if (DRY) console.log("nada foi gravado (--dry)")
