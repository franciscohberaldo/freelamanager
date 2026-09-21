// scripts/check-client-contacts.mjs — which clients have no main email, and do their
// cc_invoices contacts cover the gap? Run: node scripts/check-client-contacts.mjs
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: users } = await sb.auth.admin.listUsers()
const uid = users.users.find((u) => u.email === "franciscohberaldo@gmail.com").id

const { data: clients } = await sb.from("clients").select("id, name, email").eq("user_id", uid).order("name")
const { data: contacts } = await sb.from("client_contacts").select("client_id, name, email, cc_invoices")

for (const c of clients ?? []) {
  const marked = (contacts ?? []).filter(k => k.client_id === c.id && k.cc_invoices)
  const gap = !c.email?.trim()
  console.log(
    (gap ? "SEM EMAIL" : "ok       "),
    "|", c.name,
    "| principal:", c.email || "(vazio)",
    "| contatos marcados:", marked.map(m => `${m.name} <${m.email}>`).join(", ") || "nenhum",
  )
}
