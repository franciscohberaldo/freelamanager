// scripts/fill-client-emails.mjs — clients with an empty main email get the address of
// their contact marked cc_invoices, when one exists. Run: node scripts/fill-client-emails.mjs [--dry]
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users } = await sb.auth.admin.listUsers()
const uid = users.users.find((u) => u.email === "franciscohberaldo@gmail.com").id

const { data: clients } = await sb.from("clients").select("id, name, email").eq("user_id", uid)
const { data: contacts } = await sb.from("client_contacts").select("client_id, name, email, cc_invoices")

let updated = 0
for (const c of clients ?? []) {
  if (c.email?.trim()) continue
  const marked = (contacts ?? []).filter(k => k.client_id === c.id && k.cc_invoices && k.email?.trim())
  if (marked.length === 0) { console.log("—", c.name, "(sem contato marcado com e-mail)"); continue }
  const email = marked[0].email.trim()
  console.log(`${dry ? "[dry] " : ""}${c.name} → ${email} (${marked[0].name})`)
  if (!dry) {
    const { error } = await sb.from("clients").update({ email }).eq("id", c.id)
    if (error) { console.error("  erro:", error.message); continue }
  }
  updated++
}
console.log(dry ? `\n${updated} cliente(s) seriam atualizados` : `\n${updated} cliente(s) atualizados`)
