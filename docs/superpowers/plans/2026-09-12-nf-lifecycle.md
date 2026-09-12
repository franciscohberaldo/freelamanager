# NF Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track every nota fiscal (NF) from "pending" to "sent", request NFs from the accountant by e-mail, keep three numbering series straight, and import the historical NFs and invoices.

**Architecture:** Pure TypeScript libs (`lib/nf-status.ts`, `lib/nf-sequence.ts`, `lib/nf-request.ts`) hold the rules and are unit-tested with Vitest. Supabase migration 016 adds the columns and an atomic RPC for the invoice sequence. Next.js App Router pages/dialogs read and write through the existing Supabase browser/server clients with RLS; the accountant e-mail goes through an authenticated API route using Resend.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + RLS), jsPDF + autotable, Resend, Vitest (new dev dependency), TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-12-nf-lifecycle-design.md`

## Global Constraints

- Language of UI copy: Portuguese (pt-BR). Code, identifiers and commit messages in English.
- Every new table gets RLS with `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- `seq_number` is a 4-digit zero-padded string; the counter starts at 102 (`next_invoice_seq default 102`).
- NF statuses are exactly: `not_required | pending | requested | issued | sent`.
- NF series are exactly: `paulinia | sao_paulo`.
- A "NF acumulada" is `pending` or `requested` for more than 7 days.
- Migrations live in `supabase/migrations/` and are applied with `npx supabase db push --password "$SUPABASE_DB_PASSWORD"` (password is in `.env.local`).
- Typecheck command: `npx tsc --noEmit -p tsconfig.json`. Tests: `npm test`.
- Never commit anything under `MaterialCliente/` (gitignored).
- Commit messages end with the two attribution lines used in this repo's recent commits.

---

### Task 1: Vitest setup and the NF status state machine

**Files:**
- Modify: `package.json` (scripts + devDependencies)
- Create: `vitest.config.ts`
- Create: `src/lib/nf-status.ts`
- Test: `src/lib/__tests__/nf-status.test.ts`

**Interfaces:**
- Produces:
  - `type NfStatus = "not_required" | "pending" | "requested" | "issued" | "sent"`
  - `type NfSeries = "paulinia" | "sao_paulo"`
  - `initialNfStatus(currency: string): NfStatus` — `"BRL"` → `pending`, anything else → `not_required`
  - `canTransition(from: NfStatus, to: NfStatus): boolean`
  - `assertTransition(from: NfStatus, to: NfStatus): void` — throws `Error("Transição inválida: from → to")`
  - `isNfOverdue(status: NfStatus, since: string | null, now?: Date, days?: number): boolean` — `since` is an ISO date/timestamp; default `days = 7`
  - `NF_STATUS_LABELS: Record<NfStatus, string>`

- [ ] **Step 1: Install Vitest and add the test script**

```bash
npm install -D vitest@^2
```

Edit `package.json` scripts:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
})
```

- [ ] **Step 2: Write the failing tests**

`src/lib/__tests__/nf-status.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { initialNfStatus, canTransition, assertTransition, isNfOverdue, NF_STATUS_LABELS } from "@/lib/nf-status"

describe("initialNfStatus", () => {
  it("BRL invoices start pending", () => expect(initialNfStatus("BRL")).toBe("pending"))
  it("foreign invoices start not_required", () => {
    expect(initialNfStatus("USD")).toBe("not_required")
    expect(initialNfStatus("EUR")).toBe("not_required")
  })
})

describe("canTransition", () => {
  it.each([
    ["not_required", "pending", true],
    ["pending", "requested", true],
    ["requested", "issued", true],
    ["issued", "sent", true],
    ["pending", "issued", true],
    ["requested", "pending", true],
    ["sent", "issued", false],
    ["issued", "pending", false],
    ["not_required", "issued", false],
    ["pending", "pending", false],
  ] as const)("%s → %s = %s", (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok)
  })
  it("assertTransition throws on an invalid move", () => {
    expect(() => assertTransition("sent", "pending")).toThrow("Transição inválida: sent → pending")
    expect(() => assertTransition("pending", "requested")).not.toThrow()
  })
})

describe("isNfOverdue", () => {
  const now = new Date("2026-09-12T12:00:00Z")
  it("pending for 8 days is overdue", () => expect(isNfOverdue("pending", "2026-09-04", now)).toBe(true))
  it("pending for 6 days is not overdue", () => expect(isNfOverdue("pending", "2026-09-06", now)).toBe(false))
  it("requested for 8 days is overdue", () => expect(isNfOverdue("requested", "2026-09-04T10:00:00Z", now)).toBe(true))
  it("issued is never overdue", () => expect(isNfOverdue("issued", "2026-01-01", now)).toBe(false))
  it("missing date is not overdue", () => expect(isNfOverdue("pending", null, now)).toBe(false))
  it("custom threshold", () => expect(isNfOverdue("pending", "2026-09-10", now, 1)).toBe(true))
})

describe("labels", () => {
  it("has a Portuguese label for every status", () => {
    expect(Object.keys(NF_STATUS_LABELS).sort()).toEqual(["issued", "not_required", "pending", "requested", "sent"])
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Failed to resolve import "@/lib/nf-status"".

- [ ] **Step 4: Implement `src/lib/nf-status.ts`**

```ts
export type NfStatus = "not_required" | "pending" | "requested" | "issued" | "sent"
export type NfSeries = "paulinia" | "sao_paulo"

export const NF_STATUSES: NfStatus[] = ["not_required", "pending", "requested", "issued", "sent"]

export const NF_STATUS_LABELS: Record<NfStatus, string> = {
  not_required: "Não exigida",
  pending:      "Pendente",
  requested:    "Pedida ao contador",
  issued:       "Emitida",
  sent:         "Enviada ao cliente",
}

export const NF_SERIES_LABELS: Record<NfSeries, string> = {
  paulinia:  "Paulínia (até 2019)",
  sao_paulo: "São Paulo",
}

const TRANSITIONS: Record<NfStatus, NfStatus[]> = {
  not_required: ["pending"],
  pending:      ["requested", "issued"],
  requested:    ["issued", "pending"],
  issued:       ["sent"],
  sent:         [],
}

/** BRL invoices need an NF from the start; foreign ones only after money arrives. */
export function initialNfStatus(currency: string): NfStatus {
  return currency === "BRL" ? "pending" : "not_required"
}

export function canTransition(from: NfStatus, to: NfStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: NfStatus, to: NfStatus): void {
  if (!canTransition(from, to)) throw new Error(`Transição inválida: ${from} → ${to}`)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** "NF acumulada": pending/requested for more than `days` (default 7). */
export function isNfOverdue(status: NfStatus, since: string | null, now: Date = new Date(), days = 7): boolean {
  if (status !== "pending" && status !== "requested") return false
  if (!since) return false
  const start = new Date(since)
  if (Number.isNaN(start.getTime())) return false
  return now.getTime() - start.getTime() > days * DAY_MS
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, 1 file, all tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/nf-status.ts src/lib/__tests__/nf-status.test.ts
git commit -m "feat: NF status state machine with Vitest setup"
```

---

### Task 2: Migration 016 and Supabase types

**Files:**
- Create: `supabase/migrations/016_nf_lifecycle.sql`
- Modify: `src/lib/supabase/types.ts` (ClientRow/Insert, JobRow/Insert, InvoiceRow/Insert, InvoiceItemRow/Insert, UserSettingsRow/Insert, add NfRequest types, register `nf_requests` and the RPC)

**Interfaces:**
- Produces: DB columns listed in the spec; RPC `get_next_invoice_seq(p_user_id uuid) returns text` (4-digit string, increments `user_settings.next_invoice_seq`, creates the settings row if missing).

- [ ] **Step 1: Write the migration**

```sql
-- NF lifecycle: fiscal data, invoice sequence, NF status and accountant requests

alter table user_settings
  add column if not exists legal_name                text,
  add column if not exists municipal_registration    text,
  add column if not exists fiscal_address            text,
  add column if not exists accountant_name           text,
  add column if not exists accountant_email          text,
  add column if not exists next_invoice_seq          int not null default 102,
  add column if not exists intermediary_bank_name    text,
  add column if not exists intermediary_bank_swift   text,
  add column if not exists intermediary_bank_aba     text,
  add column if not exists intermediary_bank_account text,
  add column if not exists intermediary_bank_address text;

alter table clients
  add column if not exists legal_name      text,
  add column if not exists cnpj            text,
  add column if not exists address         text,
  add column if not exists billing_entity  text,
  add column if not exists billing_address text,
  add column if not exists nf_rules        text;

alter table jobs
  add column if not exists end_client     text,
  add column if not exists intermediary   text,
  add column if not exists nf_description text,
  add column if not exists po_number      text;

alter table invoices
  add column if not exists seq_number      text,
  add column if not exists po_number       text,
  add column if not exists nf_status       text not null default 'pending'
    check (nf_status in ('not_required','pending','requested','issued','sent')),
  add column if not exists nf_series       text check (nf_series in ('paulinia','sao_paulo')),
  add column if not exists nf_number       text,
  add column if not exists nf_issued_at    date,
  add column if not exists nf_amount_brl   numeric(12,2),
  add column if not exists nf_requested_at timestamptz,
  add column if not exists nf_sent_at      timestamptz;

-- Existing foreign-currency invoices don't need an NF until paid
update invoices set nf_status = 'not_required' where currency <> 'BRL' and nf_status = 'pending';

create unique index if not exists idx_invoices_user_seq
  on invoices(user_id, seq_number) where seq_number is not null;
create unique index if not exists idx_invoices_user_nf
  on invoices(user_id, nf_series, nf_number) where nf_number is not null;

alter table invoice_items
  add column if not exists job_number text,
  add column if not exists is_manual  boolean not null default false;

create table if not exists nf_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  sent_to    text not null,
  reply_to   text,
  subject    text not null,
  body       text not null,
  resend_id  text,
  status     text not null default 'sent' check (status in ('sent','failed')),
  error      text,
  created_at timestamptz not null default now()
);
alter table nf_requests enable row level security;
create policy "Users manage own nf_requests" on nf_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_nf_requests_invoice on nf_requests(invoice_id);

-- Atomic next invoice sequence number (4 digits, continuous)
create or replace function get_next_invoice_seq(p_user_id uuid)
returns text as $$
declare v_next int;
begin
  insert into user_settings (user_id, next_invoice_seq) values (p_user_id, 103)
  on conflict (user_id) do update set next_invoice_seq = user_settings.next_invoice_seq + 1
  returning next_invoice_seq - 1 into v_next;
  return lpad(v_next::text, 4, '0');
end;
$$ language plpgsql security definer;
```

- [ ] **Step 2: Apply the migration**

Run:
```bash
PW=$(grep -m1 '^SUPABASE_DB_PASSWORD=' .env.local | cut -d= -f2- | tr -d '\r')
npx supabase db push --password "$PW"
```
Expected: "Applying migration 016_nf_lifecycle.sql..." then "Finished supabase db push."

- [ ] **Step 3: Verify the RPC returns 0102 then 0103**

Run a throwaway script (do not commit) with the admin client:
```js
// .rpc-tmp.mjs
import { readFileSync } from 'fs'; import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} })
const { data: users } = await sb.auth.admin.listUsers(); const uid = users.users[0].id
console.log(await sb.rpc('get_next_invoice_seq', { p_user_id: uid }))
console.log(await sb.rpc('get_next_invoice_seq', { p_user_id: uid }))
await sb.from('user_settings').update({ next_invoice_seq: 102 }).eq('user_id', uid)   // reset
```
Run: `node .rpc-tmp.mjs && rm .rpc-tmp.mjs`
Expected: `data: '0102'` then `data: '0103'`.

- [ ] **Step 4: Update `src/lib/supabase/types.ts`**

Add to `ClientRow` (and optional in `ClientInsert`):
```ts
legal_name: string | null; cnpj: string | null; address: string | null;
billing_entity: string | null; billing_address: string | null; nf_rules: string | null
```
Add to `JobRow` (optional in `JobInsert`):
```ts
end_client: string | null; intermediary: string | null; nf_description: string | null; po_number: string | null
```
Add to `InvoiceRow` (optional in `InvoiceInsert`):
```ts
seq_number: string | null; po_number: string | null;
nf_status: 'not_required' | 'pending' | 'requested' | 'issued' | 'sent';
nf_series: 'paulinia' | 'sao_paulo' | null; nf_number: string | null; nf_issued_at: string | null;
nf_amount_brl: number | null; nf_requested_at: string | null; nf_sent_at: string | null
```
Add to `InvoiceItemRow` (optional in Insert): `job_number: string | null; is_manual: boolean`.
Add to `UserSettingsRow` (optional in Insert):
```ts
legal_name: string | null; municipal_registration: string | null; fiscal_address: string | null;
accountant_name: string | null; accountant_email: string | null; next_invoice_seq: number;
intermediary_bank_name: string | null; intermediary_bank_swift: string | null; intermediary_bank_aba: string | null;
intermediary_bank_account: string | null; intermediary_bank_address: string | null
```
Add:
```ts
type NfRequestRow = {
  id: string; user_id: string; invoice_id: string; sent_to: string; reply_to: string | null;
  subject: string; body: string; resend_id: string | null; status: 'sent' | 'failed'; error: string | null; created_at: string
}
type NfRequestInsert = {
  user_id: string; invoice_id: string; sent_to: string; reply_to?: string | null; subject: string; body: string;
  resend_id?: string | null; status?: 'sent' | 'failed'; error?: string | null
}
```
Register in `Database.public.Tables`:
```ts
nf_requests: { Row: NfRequestRow; Insert: NfRequestInsert; Update: Partial<NfRequestInsert>; Relationships: [] }
```
Register in `Database.public.Functions` next to `get_next_invoice_number`:
```ts
get_next_invoice_seq: { Args: { p_user_id: string }; Returns: string }
```
Export alias: `export type NfRequest = Database['public']['Tables']['nf_requests']['Row']`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/016_nf_lifecycle.sql src/lib/supabase/types.ts
git commit -m "feat: migration 016 for NF lifecycle (fiscal data, invoice seq, nf_requests)"
```

---

### Task 3: Sequence gap and duplicate detection

**Files:**
- Create: `src/lib/nf-sequence.ts`
- Test: `src/lib/__tests__/nf-sequence.test.ts`

**Interfaces:**
- Produces:
  - `findGaps(numbers: (string | null)[]): { from: number; to: number }[]` — numeric gaps between min and max of the parsed integers, ignoring nulls/non-numeric.
  - `findDuplicates(numbers: (string | null)[]): string[]` — values appearing more than once (normalized: parsed integer re-rendered as string, so "0089" and "89" collide).
  - `padSeq(n: number): string` — 4-digit zero pad.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest"
import { findGaps, findDuplicates, padSeq } from "@/lib/nf-sequence"

describe("findGaps", () => {
  it("returns ranges of missing numbers", () => {
    expect(findGaps(["0100", "0101", "0089", "0079", "0080"])).toEqual([{ from: 81, to: 88 }, { from: 90, to: 99 }])
  })
  it("ignores nulls and junk", () => {
    expect(findGaps(["1", null, "x", "3"])).toEqual([{ from: 2, to: 2 }])
  })
  it("empty when contiguous or fewer than two values", () => {
    expect(findGaps(["5", "6", "7"])).toEqual([])
    expect(findGaps(["5"])).toEqual([])
    expect(findGaps([])).toEqual([])
  })
})

describe("findDuplicates", () => {
  it("normalizes leading zeros", () => {
    expect(findDuplicates(["0089", "89", "0100", null])).toEqual(["89"])
  })
  it("returns each duplicate once, sorted", () => {
    expect(findDuplicates(["7", "7", "7", "3", "3"])).toEqual(["3", "7"])
  })
})

describe("padSeq", () => {
  it("pads to 4 digits", () => {
    expect(padSeq(102)).toBe("0102")
    expect(padSeq(12345)).toBe("12345")
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/nf-sequence`.

- [ ] **Step 3: Implement `src/lib/nf-sequence.ts`**

```ts
function parse(values: (string | null)[]): number[] {
  return values
    .map((v) => (v == null ? NaN : parseInt(String(v).replace(/\D/g, ""), 10)))
    .filter((n) => Number.isInteger(n))
}

export function padSeq(n: number): string {
  return String(n).padStart(4, "0")
}

/** Missing ranges between the smallest and largest number. */
export function findGaps(values: (string | null)[]): { from: number; to: number }[] {
  const nums = Array.from(new Set(parse(values))).sort((a, b) => a - b)
  if (nums.length < 2) return []
  const gaps: { from: number; to: number }[] = []
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] > 1) gaps.push({ from: nums[i - 1] + 1, to: nums[i] - 1 })
  }
  return gaps
}

/** Values that occur more than once after numeric normalization ("0089" == "89"). */
export function findDuplicates(values: (string | null)[]): string[] {
  const counts = new Map<number, number>()
  for (const n of parse(values)) counts.set(n, (counts.get(n) ?? 0) + 1)
  return Array.from(counts.entries())
    .filter(([, c]) => c > 1)
    .map(([n]) => String(n))
    .sort((a, b) => Number(a) - Number(b))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (2 files).

- [ ] **Step 5: Commit**

```bash
git add src/lib/nf-sequence.ts src/lib/__tests__/nf-sequence.test.ts
git commit -m "feat: invoice/NF sequence gap and duplicate detection"
```

---

### Task 4: Settings — fiscal data, accountant, intermediary bank

**Files:**
- Modify: `src/app/(app)/settings/company-form.tsx` (interface `UserSettings`, `BANK_FIELDS`, initial state, upsert, JSX before the bank section)
- Modify: `src/app/(app)/settings/page.tsx:199` (card description)

**Interfaces:**
- Consumes: columns from Task 2.
- Produces: settings rows with `legal_name`, `municipal_registration`, `fiscal_address`, `accountant_name`, `accountant_email`, `next_invoice_seq`, `intermediary_bank_*`.

- [ ] **Step 1: Extend the `UserSettings` interface and the initial state**

In `company-form.tsx`, add to `interface UserSettings`:
```ts
legal_name: string | null
municipal_registration: string | null
fiscal_address: string | null
accountant_name: string | null
accountant_email: string | null
next_invoice_seq: number
intermediary_bank_name: string | null
intermediary_bank_swift: string | null
intermediary_bank_aba: string | null
intermediary_bank_account: string | null
intermediary_bank_address: string | null
```
Add the matching entries to `useState<UserSettings>({ ... })` (strings default `""`, `next_invoice_seq: initialSettings?.next_invoice_seq ?? 102`).

Add a second field list after `BANK_FIELDS`:
```ts
const FISCAL_FIELDS: Array<{ key: keyof UserSettings; label: string; placeholder: string }> = [
  { key: "legal_name",             label: "Razão social",           placeholder: "Estúdio Judite Ltda" },
  { key: "municipal_registration", label: "Inscrição municipal (CCM)", placeholder: "64377270" },
  { key: "fiscal_address",         label: "Endereço fiscal",        placeholder: "Rua, número, complemento, bairro, cidade, UF, CEP" },
  { key: "accountant_name",        label: "Contador (nome)",        placeholder: "Nome do contador" },
  { key: "accountant_email",       label: "Contador (e-mail)",      placeholder: "contador@escritorio.com.br" },
]
const INTERMEDIARY_FIELDS: Array<{ key: keyof UserSettings; label: string; placeholder: string }> = [
  { key: "intermediary_bank_name",    label: "Banco intermediário",      placeholder: "JP Morgan Chase N.A." },
  { key: "intermediary_bank_swift",   label: "SWIFT do intermediário",   placeholder: "CHASUS33" },
  { key: "intermediary_bank_aba",     label: "ABA / routing",            placeholder: "021000021" },
  { key: "intermediary_bank_account", label: "Conta no intermediário",   placeholder: "360556937" },
  { key: "intermediary_bank_address", label: "Endereço do intermediário", placeholder: "270 Park Avenue, New York, NY 10017, US" },
]
```

- [ ] **Step 2: Persist the new fields in `handleSubmit`**

Inside the `upsert({...})` object add:
```ts
...Object.fromEntries([...FISCAL_FIELDS, ...INTERMEDIARY_FIELDS].map(f => [f.key, (form[f.key] as string | null)?.trim() || null])),
next_invoice_seq: Math.max(1, Number(form.next_invoice_seq) || 102),
```

- [ ] **Step 3: Render the sections**

Insert before the existing `<div className="space-y-3 pt-2 border-t">` (bank details block):
```tsx
<div className="space-y-3 pt-2 border-t">
  <div>
    <p className="text-sm font-medium">Dados fiscais e contador</p>
    <p className="text-xs text-muted-foreground">Usados no PDF da invoice e no pedido de NF ao contador.</p>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {FISCAL_FIELDS.map(f => (
      <div key={f.key} className={`space-y-1 ${f.key === "fiscal_address" ? "sm:col-span-2" : ""}`}>
        <Label className="text-xs">{f.label}</Label>
        <Input value={(form[f.key] as string | null) ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" />
      </div>
    ))}
    <div className="space-y-1">
      <Label className="text-xs">Próxima invoice (sequência própria)</Label>
      <Input type="number" min={1} value={form.next_invoice_seq} onChange={e => set("next_invoice_seq", parseInt(e.target.value) || 1)} />
      <p className="text-xs text-muted-foreground">Será usada na próxima invoice criada, com 4 dígitos (ex. 0102).</p>
    </div>
  </div>
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banco intermediário (wire em moeda estrangeira)</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {INTERMEDIARY_FIELDS.map(f => (
      <div key={f.key} className="space-y-1">
        <Label className="text-xs">{f.label}</Label>
        <Input value={(form[f.key] as string | null) ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} autoComplete="off" />
      </div>
    ))}
  </div>
</div>
```
Note: `set` is generic (`set<K extends keyof UserSettings>(k, v)`), so `set("next_invoice_seq", number)` typechecks.

In `settings/page.tsx` change the card description to:
`Dados exibidos nos invoices em PDF, dados fiscais, contador e dados bancários`.

- [ ] **Step 4: Typecheck and verify in the browser or via curl**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Run the dev server (`npm run dev`), open `/settings`, fill razão social, CCM, contador e-mail, save, reload: values persist.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/settings/company-form.tsx" "src/app/(app)/settings/page.tsx"
git commit -m "feat: fiscal data, accountant and intermediary bank in settings"
```

---

### Task 5: Client dialog — legal name, CNPJ, address, billing entity, NF rules

**Files:**
- Modify: `src/app/(app)/clients/client-dialog.tsx` (Props.client, form state, payload, JSX)
- Modify: `src/app/(app)/clients/clients-page-client.tsx:19,120` (show CNPJ under the company)

- [ ] **Step 1: Extend props and state**

In `Props.client` add: `legal_name?: string | null; cnpj?: string | null; address?: string | null; billing_entity?: string | null; billing_address?: string | null; nf_rules?: string | null`.

In `useState` add:
```ts
legal_name:      client?.legal_name ?? "",
cnpj:            client?.cnpj ?? "",
address:         client?.address ?? "",
billing_entity:  client?.billing_entity ?? "",
billing_address: client?.billing_address ?? "",
nf_rules:        client?.nf_rules ?? "",
```
In `payload` add:
```ts
legal_name:      form.legal_name || null,
cnpj:            form.cnpj || null,
address:         form.address || null,
billing_entity:  form.billing_entity || null,
billing_address: form.billing_address || null,
nf_rules:        form.nf_rules || null,
```

- [ ] **Step 2: Render the fiscal fields**

Change `DialogContent` to `className="max-w-lg max-h-[90vh] overflow-y-auto"`. After the "Telefone" field insert:
```tsx
<div className="pt-2 border-t space-y-3">
  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dados fiscais (tomador da NF)</p>
  <div className="space-y-2">
    <Label>Razão social</Label>
    <Input value={form.legal_name} onChange={(e) => update("legal_name", e.target.value)} placeholder="Videographica Serviços e Participações Ltda" />
  </div>
  <div className="grid grid-cols-2 gap-3">
    <div className="space-y-2">
      <Label>CNPJ</Label>
      <Input value={form.cnpj} onChange={(e) => update("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
    </div>
    <div className="space-y-2">
      <Label>Entidade de cobrança (bill to)</Label>
      <Input value={form.billing_entity} onChange={(e) => update("billing_entity", e.target.value)} placeholder="ex: Steelhead" />
    </div>
  </div>
  <div className="space-y-2">
    <Label>Endereço fiscal</Label>
    <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Rua, nº, andar, bairro, CEP, cidade, UF" />
  </div>
  <div className="space-y-2">
    <Label>Endereço de cobrança (se diferente)</Label>
    <Input value={form.billing_address} onChange={(e) => update("billing_address", e.target.value)} placeholder="12901 W. Jefferson Blvd, Los Angeles CA 90066, USA" />
  </div>
  <div className="space-y-2">
    <Label>Regras do cliente para a NF</Label>
    <Textarea value={form.nf_rules} onChange={(e) => update("nf_rules", e.target.value)} rows={3} placeholder="ex: sem palavras em inglês, sem nome do job, dados bancários no corpo da NF" />
  </div>
</div>
```

- [ ] **Step 3: Show CNPJ in the client list**

In `clients-page-client.tsx`, add `cnpj?: string | null` to the client interface (line ~19 area), and at the line rendering `{client.company && `${client.company} · `}` append `{client.cnpj && `CNPJ ${client.cnpj} · `}` right after it.

- [ ] **Step 4: Typecheck and try it**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Open `/clients`, edit "Buck", fill billing entity "Steelhead" and address; save; reopen: persisted.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/clients/client-dialog.tsx" "src/app/(app)/clients/clients-page-client.tsx"
git commit -m "feat: client fiscal data (CNPJ, address, billing entity, NF rules)"
```

---

### Task 6: Job dialog — end client, intermediary, NF description, PO

**Files:**
- Modify: `src/app/(app)/jobs/job-dialog.tsx` (schema, defaults, payload, JSX)
- Modify: `src/app/(app)/jobs/jobs-client.tsx` (interface + subtitle)

- [ ] **Step 1: Schema, defaults, payload**

In `jobSchema` add:
```ts
end_client:     z.string().optional(),
intermediary:   z.string().optional(),
nf_description: z.string().optional(),
po_number:      z.string().optional(),
```
In `defaultValues` add:
```ts
end_client:     job?.end_client ?? "",
intermediary:   job?.intermediary ?? "",
nf_description: job?.nf_description ?? "",
po_number:      job?.po_number ?? "",
```
In `payload` add:
```ts
end_client:     data.end_client?.trim() || null,
intermediary:   data.intermediary?.trim() || null,
nf_description: data.nf_description?.trim() || null,
po_number:      data.po_number?.trim() || null,
```

- [ ] **Step 2: Fields**

After the "Código do projeto" field insert:
```tsx
<div className="space-y-2">
  <Label>Cliente final (marca)</Label>
  <Input {...register("end_client")} placeholder="ex: Mastercard" />
</div>
<div className="space-y-2">
  <Label>Intermediário (estúdio)</Label>
  <Input {...register("intermediary")} placeholder="ex: Lobo" />
</div>
<div className="space-y-2">
  <Label>Nº da PO (padrão)</Label>
  <Input {...register("po_number")} placeholder="ex: 4702134214" />
</div>
<div className="space-y-2 col-span-2">
  <Label>Descrição fiscal (texto da NF)</Label>
  <Input {...register("nf_description")} placeholder="ex: Serviços prestados de animação" />
  <p className="text-xs text-muted-foreground">Vai no pedido de NF ao contador. Sem inglês, sem nome de job.</p>
</div>
```

- [ ] **Step 3: Jobs list subtitle**

In `jobs-client.tsx` `interface Job` add `end_client?: string | null; intermediary?: string | null`. In the subtitle `<p>` after the client name add:
```tsx
{job.intermediary && ` · via ${job.intermediary}`}
{job.end_client && ` · ${job.end_client}`}
```

- [ ] **Step 4: Typecheck, then set the Buck job's `nf_description` to "Serviços prestados de animação" through the UI.**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/jobs/job-dialog.tsx" "src/app/(app)/jobs/jobs-client.tsx"
git commit -m "feat: job end client, intermediary, NF description and PO"
```

---

### Task 7: Invoice creation — sequence number, PO, manual lines, initial NF status

**Files:**
- Modify: `src/app/(app)/invoices/create-invoice-dialog.tsx`
- Modify: `src/app/(app)/invoices/invoices-client.tsx` (show `seq_number` as the main number)

**Interfaces:**
- Consumes: `initialNfStatus` (Task 1), RPC `get_next_invoice_seq` (Task 2).
- Produces: invoices with `seq_number`, `po_number`, `nf_status`; items with `is_manual`, `job_number`, `description`.

- [ ] **Step 1: Add state for PO and manual lines**

Near the other `useState` calls:
```ts
const [poNumber, setPoNumber] = useState("")
type ManualLine = { description: string; job_number: string; quantity: number; rate: number }
const [manualLines, setManualLines] = useState<ManualLine[]>([])
const addLine = () => setManualLines(ls => [...ls, { description: "", job_number: "", quantity: 1, rate: 0 }])
const updLine = (i: number, patch: Partial<ManualLine>) => setManualLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
const rmLine = (i: number) => setManualLines(ls => ls.filter((_, j) => j !== i))
const manualSubtotal = manualLines.reduce((s, l) => s + l.quantity * l.rate, 0)
```
Change `fetchLogs` so that having no logs is allowed when there are manual lines: replace the `if (!data || data.length === 0) { toast.warning(...); ...; return }` block with:
```ts
if ((!data || data.length === 0) && manualLines.length === 0) { toast.warning("Nenhum registro no período e nenhuma linha livre"); setLoading(false); return }
setLogs(data ?? [])
```
Change totals:
```ts
const subtotal = logs.reduce((s, l) => s + l.total_value, 0) + manualSubtotal
```
When the job changes, prefill PO: in the job `<Select onValueChange>` use `(v) => { setJobId(v); const j = jobs.find(x => x.id === v); setPoNumber(j?.po_number ?? "") }` and add `po_number?: string | null` to `JobOption`.

- [ ] **Step 2: Use the sequence RPC and write the new columns in `createInvoice`**

Import: `import { initialNfStatus } from "@/lib/nf-status"`.
After `get_next_invoice_number` add:
```ts
const { data: seqNumber, error: seqError } = await supabase.rpc("get_next_invoice_seq", { p_user_id: user!.id })
if (seqError || !seqNumber) { toast.error("Erro ao gerar sequência da invoice"); setLoading(false); return }
```
In the `.insert({...})` add:
```ts
seq_number: seqNumber,
po_number: poNumber.trim() || null,
nf_status: initialNfStatus(selectedJob!.currency),
nf_amount_brl: selectedJob!.currency === "BRL" ? total : null,
```
After building `items` from logs, append manual lines:
```ts
const manualItems = manualLines
  .filter(l => l.description.trim() && l.quantity > 0)
  .map(l => ({
    invoice_id: invoice.id, log_id: null, date: periodEnd,
    description: l.description.trim(), job_number: l.job_number.trim() || null,
    hours_billed: 0, quantity: l.quantity, unit: "hour" as const,
    rate: l.rate, subtotal: Number((l.quantity * l.rate).toFixed(2)), is_manual: true,
  }))
const { error: itemsError } = await supabase.from("invoice_items").insert([...items, ...manualItems])
```
(Replace the existing `insert(items)` call.) Change the success toast to `Invoice ${seqNumber} criado!`.

- [ ] **Step 3: UI for PO and manual lines (config step)**

After the "Notas (opcional)" field:
```tsx
<div className="space-y-2">
  <Label>Nº da PO (opcional)</Label>
  <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="ex: 4702134214" />
</div>
<div className="space-y-2">
  <div className="flex items-center justify-between">
    <Label>Linhas livres (opcional)</Label>
    <Button type="button" variant="outline" size="sm" onClick={addLine}>+ Linha</Button>
  </div>
  {manualLines.map((l, i) => (
    <div key={i} className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-5"><Input value={l.description} onChange={e => updLine(i, { description: e.target.value })} placeholder="Descrição" /></div>
      <div className="col-span-3"><Input value={l.job_number} onChange={e => updLine(i, { job_number: e.target.value })} placeholder="Job number" /></div>
      <div className="col-span-1"><Input type="number" min={0} step="0.5" value={l.quantity} onChange={e => updLine(i, { quantity: parseFloat(e.target.value) || 0 })} /></div>
      <div className="col-span-2"><Input type="number" min={0} step="0.01" value={l.rate} onChange={e => updLine(i, { rate: parseFloat(e.target.value) || 0 })} placeholder="Valor" /></div>
      <div className="col-span-1"><Button type="button" variant="ghost" size="sm" onClick={() => rmLine(i)}>×</Button></div>
    </div>
  ))}
</div>
```
In the preview step, after the logs list add:
```tsx
{manualLines.length > 0 && (
  <div className="border-t pt-3 space-y-2">
    <p className="text-sm font-medium">Linhas livres ({manualLines.length})</p>
    {manualLines.map((l, i) => (
      <div key={i} className="flex justify-between text-sm">
        <span className="text-muted-foreground">{l.description}{l.job_number ? ` · ${l.job_number}` : ""} · {l.quantity} × {formatCurrency(l.rate, selectedJob?.currency)}</span>
        <span>{formatCurrency(l.quantity * l.rate, selectedJob?.currency)}</span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 4: Show `seq_number` in the list**

In `invoices-client.tsx` `interface Invoice` add `seq_number: string | null; nf_status: string`. Replace `#{inv.invoice_number}` with `{inv.seq_number ?? `#${inv.invoice_number}`}` and add a small badge after it:
```tsx
<Badge variant="outline" className="text-[10px]">{NF_STATUS_LABELS[inv.nf_status as NfStatus] ?? inv.nf_status}</Badge>
```
with `import { NF_STATUS_LABELS, type NfStatus } from "@/lib/nf-status"`.

- [ ] **Step 5: Typecheck, then create a test invoice**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
In the UI, create an invoice for the Buck job with one manual line "Setup" 1 × 100 and no logs; expect seq `0102`, status "Não exigida" (USD). Delete it afterwards from the DB or keep it as a draft if useful. Reset `next_invoice_seq` to 102 in settings if you delete it.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/invoices/create-invoice-dialog.tsx" "src/app/(app)/invoices/invoices-client.tsx"
git commit -m "feat: invoice sequence number, PO and manual lines"
```

---

### Task 8: PDF — tomador data, PO, bill to, manual lines, payment instructions

**Files:**
- Modify: `src/lib/invoice-pdf.ts`
- Modify: `src/lib/invoice-i18n.ts` (new strings)
- Modify: `src/app/api/invoices/pdf/route.ts` and `src/app/api/portal/pdf/route.ts` (pass new fields)

**Interfaces:**
- Consumes: settings columns (Task 4), client columns (Task 5), invoice/item columns (Task 7).
- Produces: `InvoicePDFParams.invoice` gains `seq_number?: string | null; po_number?: string | null`; `client` gains `legal_name?, cnpj?, address?, billing_entity?, billing_address?`; `settings` gains `legal_name?, fiscal_address?, phone?` (phone from `user_settings`? not present → omit) and the `intermediary_bank_*` fields; items gain `description?, job_number?, is_manual?`.

- [ ] **Step 1: i18n strings**

In both `pt` and `en` of `invoiceT` add:
```ts
// pt
purchaseOrder: "Ordem de compra", billTo: "Cobrar de", cnpj: "CNPJ", paymentInstructions: "Instruções de pagamento",
intermediaryBank: "Banco intermediário (Field 56)", destinationBank: "Banco de destino (Field 57)", beneficiaryField: "Beneficiário (Field 59)",
recipientInfo: "Dados do prestador", tableDescription: "Descrição", tableQty: "Qtd",
// en
purchaseOrder: "Purchase order", billTo: "Bill to", cnpj: "Tax ID (CNPJ)", paymentInstructions: "Payment instructions",
intermediaryBank: "Intermediary bank (Field 56)", destinationBank: "Destination bank (Field 57)", beneficiaryField: "Beneficiary (Field 59)",
recipientInfo: "Recipient info", tableDescription: "Description", tableQty: "Qty",
```

- [ ] **Step 2: Extend the params types in `invoice-pdf.ts`**

```ts
invoice: { ...existing; seq_number?: string | null; po_number?: string | null }
items: Array<{ ...existing; description?: string | null; job_number?: string | null; is_manual?: boolean | null }>
client: { name: string; company: string | null; email: string | null; legal_name?: string | null; cnpj?: string | null; address?: string | null; billing_entity?: string | null; billing_address?: string | null } | null
settings: ({ ...existing } & InvoicePDFBankDetails & {
  legal_name?: string | null; fiscal_address?: string | null;
  intermediary_bank_name?: string | null; intermediary_bank_swift?: string | null; intermediary_bank_aba?: string | null;
  intermediary_bank_account?: string | null; intermediary_bank_address?: string | null
}) | null
```

- [ ] **Step 3: Header and "to" block**

- Invoice number line: use `invoice.seq_number ?? invoice.invoice_number` (`#0102`).
- Under the "Bill To/Para" block: if `client.billing_entity` print it as the first line (bold), then `billing_address` (or `address`), then the client name as "c/o"-style second block; otherwise print `legal_name ?? name`, `company` only when different from `legal_name`, `${t.cnpj}: cnpj` when present, `address` when present, then e-mail. Use `doc.splitTextToSize(text, pageW / 2 - 30)` for addresses and advance `y` by 5 per line.
- In the Service block, after the project code line, print `${t.purchaseOrder}: ${invoice.po_number}` when present.
- Compute `divY` from the tallest of the two blocks.

- [ ] **Step 4: Table rows for manual lines**

Table head becomes `[t.tableDate, t.tableDescription, isDaily ? t.tableBilledDays : t.tableBilled, isDaily ? t.tableRateDay : t.tableRate, t.tableSubtotal]` with column widths `[26, 64, 26, 28, 28]`.
Row builder:
```ts
body: items.map((item) => {
  if (item.is_manual) {
    const desc = [item.description, item.job_number ? `Job: ${item.job_number}` : null].filter(Boolean).join(" — ")
    return [dt(item.date), desc, String(item.quantity ?? 0), cur(item.rate), cur(item.subtotal)]
  }
  const q = resolveItemQuantity(item, billingMode)
  return [dt(item.date), item.description ?? (isDaily ? t.day : t.hour), formatQuantity(q.quantity, q.unit, lang), cur(item.rate), cur(item.subtotal)]
})
```

- [ ] **Step 5: Payment instructions and recipient info (foreign currency only)**

Replace the current `paymentDetailRows` usage for `currency !== "BRL"` with a three-part block (keep PIX rows for BRL):
```ts
if (invoice.currency !== "BRL") {
  const s = settings ?? {}
  const sections: Array<[string, Array<[string, string | null | undefined]>]> = [
    [t.intermediaryBank, [["SWIFT", s.intermediary_bank_swift], ["ABA", s.intermediary_bank_aba], [t.accountNumber, s.intermediary_bank_account], [t.bankName, s.intermediary_bank_name], [t.bankAddress, s.intermediary_bank_address]]],
    [t.destinationBank, [["SWIFT", s.bank_swift], [t.bankName, s.bank_name], [t.bankAddress, s.bank_address]]],
    [t.beneficiaryField, [[t.beneficiary, s.bank_beneficiary ?? s.legal_name], ["IBAN", s.bank_iban], [t.accountNumber, s.bank_account_number], [t.routing, s.bank_routing]]],
  ]
  // print: section title bold 9pt, then label: value rows 9pt, skip empty values; page-break guard as in the existing block
}
```
Then a "Recipient info" block: `legal_name ?? company_name`, `fiscal_address`, e-mail is not stored in settings → omit. Reuse the existing page-break guard (`if (cursorY + blockH > pageH - 20) { doc.addPage(); cursorY = 20 }`).

- [ ] **Step 6: Pass the new data from the routes**

`api/invoices/pdf/route.ts`: select `jobs(name, hourly_rate, daily_rate, billing_mode, project_code, currency, clients(name, company, email, legal_name, cnpj, address, billing_entity, billing_address))` and `invoice_items` `*` (already). Settings already `select("*")`.
`api/portal/pdf/route.ts`: `clients(*)` already; pass the same client fields; items select add `description, job_number, is_manual`.

- [ ] **Step 7: Typecheck and render sample PDFs**

Run: `npx tsc --noEmit -p tsconfig.json` → exit 0.
Create `.pdf-test-tmp.ts` (do not commit) modeled on the Deutsch invoice: USD, `po_number: "4702134214"`, client `billing_entity: "Steelhead"`, two manual items with job numbers, settings with intermediary bank filled. Run with `npx tsx --tsconfig tsconfig.json .pdf-test-tmp.ts`, open the PDF, confirm: PO line, "Bill to: Steelhead", two description rows, three payment sections, recipient info. Also render a BRL sample and confirm CNPJ/endereço under "Para" and PIX block unchanged. Delete the temp script.

- [ ] **Step 8: Commit**

```bash
git add src/lib/invoice-pdf.ts src/lib/invoice-i18n.ts src/app/api/invoices/pdf/route.ts src/app/api/portal/pdf/route.ts
git commit -m "feat: invoice PDF with PO, bill-to entity, free lines and wire payment instructions"
```

---

### Task 9: NF request to the accountant (builder + API + dialog)

**Files:**
- Create: `src/lib/nf-request.ts`
- Test: `src/lib/__tests__/nf-request.test.ts`
- Create: `src/app/api/invoices/nf-request/route.ts`
- Create: `src/app/(app)/invoices/nf-request-dialog.tsx`
- Modify: `src/app/(app)/invoices/invoice-actions.tsx` (menu item + dialog)

**Interfaces:**
- Produces:
  - `buildNfRequest(input: NfRequestInput): { subject: string; body: string }` where
    ```ts
    type NfRequestInput = {
      seqNumber: string; clientName: string; legalName: string | null; cnpj: string | null; address: string | null;
      nfDescription: string | null; amountBrl: number; dueDate: string | null; nfRules: string | null;
      provider: { legalName: string | null; cnpj: string | null; bankName: string | null; bankAgency?: string | null; bankAccount: string | null; pixKey: string | null };
      invoicePdfUrl: string | null; accountantName: string | null
    }
    ```
  - `POST /api/invoices/nf-request` body `{ invoiceId, subject?, body? }` → sends via Resend to `accountant_email`, inserts `nf_requests`, sets `nf_status = requested`, `nf_requested_at = now()`; returns `{ ok: true, requestId }`.

- [ ] **Step 1: Failing tests for the builder**

```ts
import { describe, it, expect } from "vitest"
import { buildNfRequest } from "@/lib/nf-request"

const base = {
  seqNumber: "0102", clientName: "Lobo", legalName: "Videographica Serviços e Participações Ltda",
  cnpj: "61.372.843/0001-03", address: "Rua Joaquim Floriano, 913 8º andar - Itaim Bibi, 04534-013 São Paulo SP",
  nfDescription: "Serviços prestados de animação", amountBrl: 19200, dueDate: "2025-04-25",
  nfRules: "Não mencionar nomes de jobs.", accountantName: "Ronaldo",
  provider: { legalName: "Estúdio Judite Ltda", cnpj: "11.241.505/0001-64", bankName: "Banco Inter", bankAgency: "0001", bankAccount: "24188764-0", pixKey: null },
  invoicePdfUrl: "https://app/api/invoices/pdf?id=abc",
}

describe("buildNfRequest", () => {
  it("subject carries seq and client", () => {
    expect(buildNfRequest(base).subject).toBe("Pedido de NF — Invoice 0102 — Lobo")
  })
  it("body has tomador, description, value, due date, bank and rules", () => {
    const { body } = buildNfRequest(base)
    expect(body).toContain("Videographica Serviços e Participações Ltda")
    expect(body).toContain("CNPJ: 61.372.843/0001-03")
    expect(body).toContain("Descrição: Serviços prestados de animação")
    expect(body).toContain("Valor: R$ 19.200,00")
    expect(body).toContain("Vencimento: 25/04/2025")
    expect(body).toContain("Banco: Banco Inter")
    expect(body).toContain("Não mencionar nomes de jobs.")
    expect(body).toContain("https://app/api/invoices/pdf?id=abc")
    expect(body.startsWith("Olá Ronaldo,")).toBe(true)
  })
  it("falls back gracefully when optional fields are missing", () => {
    const { body } = buildNfRequest({ ...base, legalName: null, cnpj: null, address: null, dueDate: null, nfRules: null, accountantName: null, invoicePdfUrl: null, nfDescription: null })
    expect(body.startsWith("Olá,")).toBe(true)
    expect(body).toContain("Tomador: Lobo")
    expect(body).toContain("Descrição: (preencher)")
    expect(body).not.toContain("Vencimento:")
  })
})
```

- [ ] **Step 2: Run tests, expect failure to resolve `@/lib/nf-request`.**

- [ ] **Step 3: Implement `src/lib/nf-request.ts`**

```ts
export type NfRequestInput = {
  seqNumber: string
  clientName: string
  legalName: string | null
  cnpj: string | null
  address: string | null
  nfDescription: string | null
  amountBrl: number
  dueDate: string | null
  nfRules: string | null
  accountantName: string | null
  provider: { legalName: string | null; cnpj: string | null; bankName: string | null; bankAgency?: string | null; bankAccount: string | null; pixKey: string | null }
  invoicePdfUrl: string | null
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v)
const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split("-"); return `${d}/${m}/${y}` }

export function buildNfRequest(i: NfRequestInput): { subject: string; body: string } {
  const subject = `Pedido de NF — Invoice ${i.seqNumber} — ${i.clientName}`
  const lines: string[] = []
  lines.push(i.accountantName ? `Olá ${i.accountantName},` : "Olá,")
  lines.push("", `Por favor, emitir a nota fiscal referente à invoice ${i.seqNumber}.`, "")
  lines.push("TOMADOR")
  lines.push(`Tomador: ${i.legalName ?? i.clientName}`)
  if (i.cnpj) lines.push(`CNPJ: ${i.cnpj}`)
  if (i.address) lines.push(`Endereço: ${i.address}`)
  lines.push("", "SERVIÇO")
  lines.push(`Descrição: ${i.nfDescription ?? "(preencher)"}`)
  lines.push(`Valor: ${brl(i.amountBrl)}`)
  if (i.dueDate) lines.push(`Vencimento: ${dmy(i.dueDate)}`)
  lines.push("", "DADOS BANCÁRIOS DO PRESTADOR (para constar na NF)")
  if (i.provider.legalName) lines.push(`Empresa: ${i.provider.legalName}`)
  if (i.provider.cnpj) lines.push(`CNPJ: ${i.provider.cnpj}`)
  if (i.provider.bankName) lines.push(`Banco: ${i.provider.bankName}`)
  if (i.provider.bankAgency) lines.push(`Agência: ${i.provider.bankAgency}`)
  if (i.provider.bankAccount) lines.push(`Conta: ${i.provider.bankAccount}`)
  if (i.provider.pixKey) lines.push(`PIX: ${i.provider.pixKey}`)
  if (i.nfRules) lines.push("", "REGRAS DO CLIENTE", i.nfRules)
  if (i.invoicePdfUrl) lines.push("", `Invoice (PDF): ${i.invoicePdfUrl}`)
  lines.push("", "Obrigado!")
  return { subject, body: lines.join("\n") }
}
```

- [ ] **Step 4: Run tests, expect PASS (3 files).**

- [ ] **Step 5: API route `src/app/api/invoices/nf-request/route.ts`**

```ts
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { buildNfRequest } from "@/lib/nf-request"
import { assertTransition, type NfStatus } from "@/lib/nf-status"

export async function POST(request: NextRequest) {
  const { invoiceId, subject: customSubject, body: customBody } = await request.json().catch(() => ({}))
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices")
      .select("id, seq_number, invoice_number, currency, total, due_date, nf_status, nf_amount_brl, jobs(name, nf_description, clients(name, legal_name, cnpj, address, nf_rules))")
      .eq("id", invoiceId).eq("user_id", user.id).single(),
    supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
  ])
  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })
  if (!settings?.accountant_email) return NextResponse.json({ error: "Cadastre o e-mail do contador em Configurações" }, { status: 400 })

  try { assertTransition(invoice.nf_status as NfStatus, "requested") }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 409 }) }

  const job = invoice.jobs as unknown as { name: string; nf_description: string | null; clients: { name: string; legal_name: string | null; cnpj: string | null; address: string | null; nf_rules: string | null } | null } | null
  const client = job?.clients ?? null
  const amountBrl = invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : 0)
  if (!amountBrl) return NextResponse.json({ error: "Valor em reais da NF não definido" }, { status: 400 })

  const built = buildNfRequest({
    seqNumber: invoice.seq_number ?? invoice.invoice_number,
    clientName: client?.name ?? job?.name ?? "Cliente",
    legalName: client?.legal_name ?? null, cnpj: client?.cnpj ?? null, address: client?.address ?? null,
    nfDescription: job?.nf_description ?? null, amountBrl, dueDate: invoice.due_date, nfRules: client?.nf_rules ?? null,
    accountantName: settings.accountant_name,
    provider: { legalName: settings.legal_name, cnpj: settings.cnpj_cpf, bankName: settings.bank_name, bankAccount: settings.bank_account_number, pixKey: settings.pix_key },
    invoicePdfUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}/api/invoices/pdf?id=${invoice.id}&lang=pt`,
  })
  const subject = typeof customSubject === "string" && customSubject.trim() ? customSubject : built.subject
  const body    = typeof customBody === "string" && customBody.trim() ? customBody : built.body

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data: sent, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "invoices@freelamanager.com",
    to: [settings.accountant_email],
    subject, text: body,
  })

  const { data: req } = await supabase.from("nf_requests").insert({
    user_id: user.id, invoice_id: invoice.id, sent_to: settings.accountant_email, subject, body,
    resend_id: sent?.id ?? null, status: error ? "failed" : "sent", error: error?.message ?? null,
  }).select("id").single()

  if (error) return NextResponse.json({ error: error.message, requestId: req?.id }, { status: 502 })

  await supabase.from("invoices").update({ nf_status: "requested", nf_requested_at: new Date().toISOString() }).eq("id", invoice.id)
  return NextResponse.json({ ok: true, requestId: req?.id })
}

/** Preview without sending */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("invoiceId")
  if (!invoiceId) return NextResponse.json({ error: "invoiceId obrigatório" }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices")
      .select("id, seq_number, invoice_number, currency, total, due_date, nf_amount_brl, jobs(name, nf_description, clients(name, legal_name, cnpj, address, nf_rules))")
      .eq("id", invoiceId).eq("user_id", user.id).single(),
    supabase.from("user_settings").select("*").eq("user_id", user.id).single(),
  ])
  if (!invoice) return NextResponse.json({ error: "Invoice não encontrado" }, { status: 404 })
  const job = invoice.jobs as unknown as { name: string; nf_description: string | null; clients: { name: string; legal_name: string | null; cnpj: string | null; address: string | null; nf_rules: string | null } | null } | null
  const client = job?.clients ?? null
  const built = buildNfRequest({
    seqNumber: invoice.seq_number ?? invoice.invoice_number, clientName: client?.name ?? job?.name ?? "Cliente",
    legalName: client?.legal_name ?? null, cnpj: client?.cnpj ?? null, address: client?.address ?? null,
    nfDescription: job?.nf_description ?? null, amountBrl: invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : 0),
    dueDate: invoice.due_date, nfRules: client?.nf_rules ?? null, accountantName: settings?.accountant_name ?? null,
    provider: { legalName: settings?.legal_name ?? null, cnpj: settings?.cnpj_cpf ?? null, bankName: settings?.bank_name ?? null, bankAccount: settings?.bank_account_number ?? null, pixKey: settings?.pix_key ?? null },
    invoicePdfUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}/api/invoices/pdf?id=${invoice.id}&lang=pt`,
  })
  return NextResponse.json({ ...built, to: settings?.accountant_email ?? null })
}
```

- [ ] **Step 6: Dialog `nf-request-dialog.tsx`**

```tsx
"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Send } from "lucide-react"

export function NfRequestDialog({ invoiceId, open, onClose }: { invoiceId: string; open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [to, setTo] = useState<string | null>(null)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/invoices/nf-request?invoiceId=${invoiceId}`)
      .then(r => r.json())
      .then(d => { if (d.error) toast.error(d.error); else { setTo(d.to); setSubject(d.subject); setBody(d.body) } })
      .finally(() => setLoading(false))
  }, [open, invoiceId])

  async function send() {
    setSending(true)
    const res = await fetch("/api/invoices/nf-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId, subject, body }) })
    const d = await res.json()
    if (res.ok) { toast.success("Pedido enviado ao contador"); router.refresh(); onClose() }
    else toast.error(d.error ?? "Erro ao enviar")
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pedir NF ao contador</DialogTitle>
          <DialogDescription>{to ? `Para: ${to}` : "Cadastre o e-mail do contador em Configurações."}</DialogDescription>
        </DialogHeader>
        {loading ? <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /></div> : (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Assunto</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
            <div className="space-y-1"><Label>Mensagem</Label><Textarea rows={16} className="font-mono text-xs" value={body} onChange={e => setBody(e.target.value)} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={send} disabled={sending || loading || !to}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 7: Wire into `invoice-actions.tsx`**

Add state `const [nfOpen, setNfOpen] = useState(false)`, import `NfRequestDialog`, `Receipt` icon from lucide-react and `NF_STATUS_LABELS`/`canTransition` from `@/lib/nf-status`. In the dropdown after the AI item add:
```tsx
<DropdownMenuSeparator />
<DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Nota fiscal · {NF_STATUS_LABELS[invoice.nf_status]}</DropdownMenuLabel>
{canTransition(invoice.nf_status, "requested") && (
  <DropdownMenuItem onClick={() => setNfOpen(true)} className="pl-6">Pedir NF ao contador</DropdownMenuItem>
)}
```
Render `<NfRequestDialog invoiceId={invoice.id} open={nfOpen} onClose={() => setNfOpen(false)} />` next to the other dialogs at the bottom.

- [ ] **Step 8: Typecheck and send a real test**

Temporarily set the accountant e-mail in Settings to the user's own address, open a BRL invoice (create one for a BRL job if none), "Pedir NF ao contador", edit nothing, send. Expect: e-mail received, invoice badge "Pedida ao contador", one row in `nf_requests`. Restore the accountant e-mail afterwards.

- [ ] **Step 9: Commit**

```bash
git add src/lib/nf-request.ts src/lib/__tests__/nf-request.test.ts src/app/api/invoices/nf-request/route.ts "src/app/(app)/invoices/nf-request-dialog.tsx" "src/app/(app)/invoices/invoice-actions.tsx"
git commit -m "feat: request NF from accountant by e-mail with editable preview"
```

---

### Task 10: NF actions (register, mark sent, cancel) and the payment hook

**Files:**
- Create: `src/app/(app)/invoices/nf-register-dialog.tsx`
- Modify: `src/app/(app)/invoices/invoice-actions.tsx` (menu items; foreign payment hook in `PaymentDialog.handleSubmit`)

**Interfaces:**
- Consumes: `canTransition`, `NfSeries`, `NF_SERIES_LABELS`.
- Produces: client-side updates of `nf_status`, `nf_series`, `nf_number`, `nf_issued_at`, `nf_sent_at`, `nf_amount_brl`.

- [ ] **Step 1: Register dialog**

```tsx
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { NF_SERIES_LABELS, type NfSeries } from "@/lib/nf-status"

export function NfRegisterDialog({ invoiceId, currency, defaultAmountBrl, open, onClose }: { invoiceId: string; currency: string; defaultAmountBrl: number | null; open: boolean; onClose: () => void }) {
  const supabase = createClient(); const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ nf_series: "sao_paulo" as NfSeries, nf_number: "", nf_issued_at: format(new Date(), "yyyy-MM-dd"), nf_amount_brl: defaultAmountBrl ? String(defaultAmountBrl) : "" })

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nf_number.trim()) { toast.error("Informe o número da NF"); return }
    setLoading(true)
    const { error } = await supabase.from("invoices").update({
      nf_status: "issued", nf_series: form.nf_series, nf_number: form.nf_number.trim(), nf_issued_at: form.nf_issued_at,
      nf_amount_brl: parseFloat(form.nf_amount_brl) || defaultAmountBrl,
    }).eq("id", invoiceId)
    if (error) toast.error(error.message.includes("idx_invoices_user_nf") ? "Já existe uma NF com esse número nessa série" : "Erro ao registrar NF")
    else { toast.success("NF registrada"); router.refresh(); onClose() }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar NF emitida</DialogTitle><DialogDescription className="sr-only">Número, série e data da nota</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Série</Label>
              <Select value={form.nf_series} onValueChange={v => setForm(f => ({ ...f, nf_series: v as NfSeries }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(k => <SelectItem key={k} value={k}>{NF_SERIES_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Número da NF</Label><Input value={form.nf_number} onChange={e => setForm(f => ({ ...f, nf_number: e.target.value }))} placeholder="ex: 0102" /></div>
            <div className="space-y-1"><Label>Data de emissão</Label><Input type="date" value={form.nf_issued_at} onChange={e => setForm(f => ({ ...f, nf_issued_at: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Valor da NF (R$)</Label><Input type="number" step="0.01" value={form.nf_amount_brl} onChange={e => setForm(f => ({ ...f, nf_amount_brl: e.target.value }))} placeholder={currency === "BRL" ? "= total" : "líquido recebido"} /></div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin" />} Registrar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Menu items and simple transitions in `invoice-actions.tsx`**

Add state `nfRegisterOpen`. Add helper:
```ts
async function setNf(patch: Record<string, unknown>, okMsg: string) {
  const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id)
  if (error) toast.error("Erro ao atualizar NF"); else { toast.success(okMsg); router.refresh() }
}
```
Under the "Nota fiscal" label add:
```tsx
{canTransition(invoice.nf_status, "issued") && <DropdownMenuItem onClick={() => setNfRegisterOpen(true)} className="pl-6">Registrar NF emitida</DropdownMenuItem>}
{canTransition(invoice.nf_status, "sent") && <DropdownMenuItem onClick={() => setNf({ nf_status: "sent", nf_sent_at: new Date().toISOString() }, "NF marcada como enviada")} className="pl-6">Marcar NF enviada ao cliente</DropdownMenuItem>}
{invoice.nf_status === "requested" && <DropdownMenuItem onClick={() => setNf({ nf_status: "pending", nf_requested_at: null }, "Pedido cancelado")} className="pl-6 text-muted-foreground">Cancelar pedido</DropdownMenuItem>}
{invoice.nf_status === "not_required" && <DropdownMenuItem onClick={() => setNf({ nf_status: "pending", nf_amount_brl: invoice.nf_amount_brl ?? null }, "NF marcada como pendente")} className="pl-6">Marcar NF como pendente</DropdownMenuItem>}
```
Render `<NfRegisterDialog invoiceId={invoice.id} currency={invoice.currency} defaultAmountBrl={invoice.nf_amount_brl ?? (invoice.currency === "BRL" ? invoice.total : null)} open={nfRegisterOpen} onClose={() => setNfRegisterOpen(false)} />`.

- [ ] **Step 3: Payment hook for foreign invoices**

In `PaymentDialog.handleSubmit`, after the successful `invoice_payments` insert and before the "fully paid" check, add:
```ts
if (isForeign) {
  const { data: inv } = await supabase.from("invoices").select("nf_status, nf_amount_brl").eq("id", invoiceId).single()
  if (inv?.nf_status === "not_required") {
    await supabase.from("invoices").update({ nf_status: "pending", nf_amount_brl: (inv.nf_amount_brl ?? 0) + (receivedBrl > 0 ? receivedBrl : 0) }).eq("id", invoiceId)
  } else if (inv && receivedBrl > 0) {
    await supabase.from("invoices").update({ nf_amount_brl: (inv.nf_amount_brl ?? 0) + receivedBrl }).eq("id", invoiceId)
  }
}
```

- [ ] **Step 4: Typecheck; register a payment on a USD invoice and confirm it flips to "Pendente" with the BRL amount; register NF; mark sent.**

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/invoices/nf-register-dialog.tsx" "src/app/(app)/invoices/invoice-actions.tsx"
git commit -m "feat: register NF, mark sent, cancel request; USD payment marks NF pending"
```

---

### Task 11: "Notas fiscais" page, sidebar entry, dashboard card

**Files:**
- Create: `src/app/(app)/notas-fiscais/page.tsx`
- Create: `src/app/(app)/notas-fiscais/nf-client.tsx`
- Modify: `src/components/layout/sidebar.tsx:24` (add entry after Invoices)
- Modify: `src/components/command-palette.tsx:23` (add entry)
- Modify: `src/app/(app)/dashboard/page.tsx` (query) and `src/app/(app)/dashboard/daily-view.tsx` (card)

- [ ] **Step 1: Page (server)**

```tsx
import { createClient } from "@/lib/supabase/server"
import { NfClient, type NfRow } from "./nf-client"

export default async function NotasFiscaisPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from("invoices")
    .select("id, seq_number, invoice_number, currency, total, due_date, created_at, sent_at, nf_status, nf_series, nf_number, nf_issued_at, nf_amount_brl, nf_requested_at, nf_sent_at, jobs(name, clients(name, legal_name))")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
  return <NfClient rows={(data ?? []) as unknown as NfRow[]} />
}
```

- [ ] **Step 2: Client component**

Responsibilities: filters (status, series, year), alert strip (gaps/duplicates via `findGaps`/`findDuplicates` on `seq_number` and per-series `nf_number`), table, actions reuse `InvoiceActions` (import from `../invoices/invoice-actions` — it accepts `invoice` and `clientEmail`; pass `clientEmail={null}` and `paidAmount={0}`).

```tsx
"use client"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, formatDate } from "@/lib/utils"
import { NF_STATUS_LABELS, NF_SERIES_LABELS, isNfOverdue, type NfStatus, type NfSeries } from "@/lib/nf-status"
import { findGaps, findDuplicates } from "@/lib/nf-sequence"
import { InvoiceActions } from "../invoices/invoice-actions"
import type { Invoice } from "@/lib/supabase/types"

export type NfRow = Invoice & { jobs: { name: string; clients: { name: string; legal_name: string | null } | null } | null }

const STATUS_VARIANT: Record<NfStatus, "outline" | "warning" | "default" | "success" | "destructive"> = {
  not_required: "outline", pending: "warning", requested: "default", issued: "success", sent: "success",
}

export function NfClient({ rows }: { rows: NfRow[] }) {
  const [status, setStatus] = useState<"all" | NfStatus>("all")
  const [series, setSeries] = useState<"all" | NfSeries>("all")
  const [year, setYear] = useState<string>("all")
  const years = useMemo(() => Array.from(new Set(rows.map(r => (r.nf_issued_at ?? r.created_at).slice(0, 4)))).sort().reverse(), [rows])

  const visible = rows.filter(r => r.nf_status !== "not_required")
    .filter(r => status === "all" || r.nf_status === status)
    .filter(r => series === "all" || r.nf_series === series)
    .filter(r => year === "all" || (r.nf_issued_at ?? r.created_at).startsWith(year))

  const seqGaps = findGaps(rows.map(r => r.seq_number)); const seqDups = findDuplicates(rows.map(r => r.seq_number))
  const nfAlerts = (Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(s => {
    const nums = rows.filter(r => r.nf_series === s).map(r => r.nf_number)
    return { series: s, gaps: findGaps(nums), dups: findDuplicates(nums) }
  }).filter(a => a.gaps.length || a.dups.length)

  const overdue = visible.filter(r => isNfOverdue(r.nf_status, r.nf_requested_at ?? r.sent_at ?? r.created_at))
  const fmtGap = (g: { from: number; to: number }) => g.from === g.to ? String(g.from) : `${g.from}–${g.to}`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notas fiscais</h1>
        <p className="text-muted-foreground text-sm">{visible.length} invoices com NF · {overdue.length} acumuladas há mais de 7 dias</p>
      </div>

      {(seqGaps.length > 0 || seqDups.length > 0 || nfAlerts.length > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20"><CardContent className="py-3 text-sm space-y-1">
          {seqGaps.length > 0 && <p>Lacunas na sequência de invoices: {seqGaps.map(fmtGap).join(", ")}</p>}
          {seqDups.length > 0 && <p>Invoices duplicadas: {seqDups.join(", ")}</p>}
          {nfAlerts.map(a => (
            <p key={a.series}>{NF_SERIES_LABELS[a.series]}: {a.gaps.length > 0 && `lacunas ${a.gaps.map(fmtGap).join(", ")}`}{a.gaps.length > 0 && a.dups.length > 0 && " · "}{a.dups.length > 0 && `duplicadas ${a.dups.join(", ")}`}</p>
          ))}
        </CardContent></Card>
      )}

      <div className="flex gap-2 flex-wrap">
        <Select value={status} onValueChange={v => setStatus(v as typeof status)}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os status</SelectItem>{(Object.keys(NF_STATUS_LABELS) as NfStatus[]).filter(s => s !== "not_required").map(s => <SelectItem key={s} value={s}>{NF_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
        <Select value={series} onValueChange={v => setSeries(v as typeof series)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todas as séries</SelectItem>{(Object.keys(NF_SERIES_LABELS) as NfSeries[]).map(s => <SelectItem key={s} value={s}>{NF_SERIES_LABELS[s]}</SelectItem>)}</SelectContent></Select>
        <Select value={year} onValueChange={setYear}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os anos</SelectItem>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent></Select>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>
            <th className="text-left p-2">Invoice</th><th className="text-left p-2">NF</th><th className="text-left p-2">Emissão</th><th className="text-left p-2">Tomador</th><th className="text-right p-2">Valor (R$)</th><th className="text-left p-2">Status</th><th className="p-2"></th>
          </tr></thead>
          <tbody>
            {visible.map(r => {
              const late = isNfOverdue(r.nf_status, r.nf_requested_at ?? r.sent_at ?? r.created_at)
              return (
                <tr key={r.id} className={`border-t ${late ? "bg-red-50 dark:bg-red-950/20" : ""}`}>
                  <td className="p-2 font-mono">{r.seq_number ?? `#${r.invoice_number}`}</td>
                  <td className="p-2 font-mono">{r.nf_number ? `${r.nf_number} · ${r.nf_series ? NF_SERIES_LABELS[r.nf_series] : ""}` : "—"}</td>
                  <td className="p-2">{r.nf_issued_at ? formatDate(r.nf_issued_at) : "—"}</td>
                  <td className="p-2">{r.jobs?.clients?.legal_name ?? r.jobs?.clients?.name ?? "—"}<span className="text-muted-foreground"> · {r.jobs?.name}</span></td>
                  <td className="p-2 text-right">{r.nf_amount_brl != null ? formatCurrency(r.nf_amount_brl) : (r.currency === "BRL" ? formatCurrency(r.total) : "—")}</td>
                  <td className="p-2"><Badge variant={STATUS_VARIANT[r.nf_status]}>{NF_STATUS_LABELS[r.nf_status]}</Badge>{late && <span className="ml-1 text-xs text-red-600">atrasada</span>}</td>
                  <td className="p-2 text-right"><InvoiceActions invoice={r as never} clientEmail={null} paidAmount={0} /></td>
                </tr>
              )
            })}
            {visible.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma nota nesse filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```
Note: if `Badge` lacks a `warning` variant, check `src/components/ui/badge.tsx`; `invoices-client.tsx` already uses `"warning"` and `"success"`, so they exist.

- [ ] **Step 3: Sidebar and command palette**

`sidebar.tsx` line 24: after `{ href: "/invoices",  label: "Invoices", icon: FileText },` add `{ href: "/notas-fiscais", label: "Notas fiscais", icon: Receipt },` and add `Receipt` to the lucide import at the top of the file.
`command-palette.tsx` line 23: add `{ id: "nf", label: "Notas fiscais", href: "/notas-fiscais", icon: Receipt, category: "Páginas" },` and import `Receipt`.

- [ ] **Step 4: Dashboard card**

`dashboard/page.tsx`: add to the `Promise.all` a query
```ts
supabase.from("invoices").select("id, seq_number, invoice_number, nf_status, nf_amount_brl, total, currency, nf_requested_at, sent_at, created_at, jobs(name)")
  .eq("user_id", user!.id).in("nf_status", ["pending", "requested"]).order("created_at"),
```
destructured as `{ data: nfPending }`, and pass `nfPending: (nfPending ?? []) as unknown as NfPendingRow[]` into the `daily` props.
`daily-view.tsx`: add `export interface NfPendingRow { id: string; seq_number: string | null; invoice_number: string; nf_status: "pending" | "requested"; nf_amount_brl: number | null; total: number; currency: string; nf_requested_at: string | null; sent_at: string | null; created_at: string; jobs: { name: string } | null }`, add `nfPending: NfPendingRow[]` to `DailyViewProps`, and render after the KPI grid:
```tsx
{nfPending.length > 0 && (
  <Card className="border-amber-300">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">NFs pendentes</CardTitle>
      <Link href="/notas-fiscais" className="text-xs text-primary hover:underline">Ver todas</Link>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-bold">{nfPending.length}<span className="text-sm font-normal text-muted-foreground ml-2">{formatCurrency(nfPending.reduce((s, n) => s + (n.nf_amount_brl ?? (n.currency === "BRL" ? n.total : 0)), 0))}</span></p>
      <p className="text-xs text-muted-foreground mt-1">Mais antiga: {nfPending[0].seq_number ?? `#${nfPending[0].invoice_number}`} · {nfPending[0].jobs?.name ?? "—"} · {NF_STATUS_LABELS[nfPending[0].nf_status]}</p>
    </CardContent>
  </Card>
)}
```
with `import { NF_STATUS_LABELS } from "@/lib/nf-status"`.

- [ ] **Step 5: Typecheck, open `/notas-fiscais` and the dashboard; both render.**

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/notas-fiscais" src/components/layout/sidebar.tsx src/components/command-palette.tsx "src/app/(app)/dashboard/page.tsx" "src/app/(app)/dashboard/daily-view.tsx"
git commit -m "feat: notas fiscais page with gap/duplicate alerts, sidebar entry and dashboard card"
```

---

### Task 12: Import the historical clients, NFs and invoices

**Files:**
- Create: `scripts/import-nf-history.mjs` (committed; reads CSVs from `MaterialCliente/`, which stays gitignored)
- Input: `MaterialCliente/nf_historico_paulinia.csv` (columns `file,tipo,nf,data,tomador,cnpj_tomador,valor,descricao,erro`), `MaterialCliente/Acompanhamento de projetos - Sheet1.csv`, and an inline list of the international invoices read from the PDFs.

- [ ] **Step 1: Write the script**

```js
// scripts/import-nf-history.mjs — idempotent. Run: node scripts/import-nf-history.mjs [--dry]
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const dry = process.argv.includes("--dry")
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter(l => l.includes("=") && !l.startsWith("#")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
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
const brl = s => Number(String(s).replace(/[R$\s.]/g, "").replace(",", ".")) || 0
const isoFromBr = s => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null }
const isoFromUs = s => { const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[1]}-${m[2]}` : null }

// Canonical client names (map raw tomador → name)
const CANON = [
  [/videographica/i, "Videographica"], [/lobo multimidia/i, "Lobo"], [/cinemalink/i, "Cinemalink"], [/sam transmedia/i, "SAM Transmedia (Kumite)"],
  [/polis/i, "Polis Propaganda"], [/mais filmes/i, "Mais Filmes"], [/jofilsan/i, "Jofilsan"], [/capela/i, "A Capela"], [/tollmeiner|quanta/i, "Quanta"],
  [/a00/i, "A00 Produções"], [/arvore/i, "Árvore"], [/tabuleiro/i, "Tabuleiro Filmes"],
]
const canon = raw => (CANON.find(([re]) => re.test(raw))?.[1]) ?? raw.replace(/\s+(ltda|eireli|me|epp)\.?.*$/i, "").trim()

async function upsertClient({ name, legal_name, cnpj, address, notes }) {
  const { data: ex } = await sb.from("clients").select("id, cnpj").eq("user_id", uid).eq("name", name).maybeSingle()
  if (ex) { if (!ex.cnpj && cnpj && !dry) await sb.from("clients").update({ cnpj, legal_name, address }).eq("id", ex.id); return ex.id }
  if (dry) { console.log("[dry] client", name); return "dry" }
  const { data, error } = await sb.from("clients").insert({ user_id: uid, name, legal_name, cnpj, address, notes }).select("id").single()
  if (error) throw error; console.log("client +", name); return data.id
}
async function historyJob(clientId, clientName, currency) {
  const name = `Histórico ${clientName}`
  const { data: ex } = await sb.from("jobs").select("id").eq("user_id", uid).eq("client_id", clientId).eq("name", name).maybeSingle()
  if (ex) return ex.id
  if (dry) return "dry"
  const { data, error } = await sb.from("jobs").insert({ user_id: uid, client_id: clientId, name, currency, status: "completed", hourly_rate: 0, daily_rate: 0, is_recurring: false, tax_rate: 0, notes: "Job de ancoragem para invoices importadas" }).select("id").single()
  if (error) throw error; return data.id
}
async function insertInvoice(row) {
  const { data: ex } = await sb.from("invoices").select("id").eq("user_id", uid).eq("seq_number", row.seq_number).maybeSingle()
  if (ex) { console.log("skip (exists)", row.seq_number); return }
  if (dry) { console.log("[dry] invoice", row.seq_number, row.total, row.currency); return }
  const { error } = await sb.from("invoices").insert({ user_id: uid, status: "paid", ...row })
  if (error) console.error("ERR", row.seq_number, error.message); else console.log("invoice +", row.seq_number)
}

// 1) Paulínia NFs 50–117
for (const r of csv("MaterialCliente/nf_historico_paulinia.csv").filter(r => r.tipo === "nfse" && r.nf)) {
  const name = canon(r.tomador)
  const cid = await upsertClient({ name, legal_name: r.tomador, cnpj: r.cnpj_tomador || null, address: null, notes: "Importado do histórico de NFs (Paulínia)" })
  const jid = await historyJob(cid, name, "BRL")
  const date = isoFromBr(r.data) ?? "2016-01-01"
  await insertInvoice({
    job_id: jid, invoice_number: `H-${r.nf.padStart(3, "0")}`, seq_number: `NFP${r.nf.padStart(3, "0")}`,
    period_start: date, period_end: date, total_hours_billed: 0, subtotal: brl(r.valor), tax_rate: 0, tax_amount: 0, total: brl(r.valor),
    currency: "BRL", nf_status: "sent", nf_series: "paulinia", nf_number: r.nf, nf_issued_at: date, nf_amount_brl: brl(r.valor), sent_at: date, paid_at: date, notes: r.descricao || null,
  })
}

// 2) International invoices read from the PDFs (seq, date, client, currency, total, po)
const INTL = [
  ["0006", "2022-07-01", "State Design", "USD", null, null], ["0007", "2022-07-15", "State Design", "USD", null, null], ["0008", "2022-08-03", "State Design", "USD", null, null],
  ["0009", "2022-08-26", "State Design", "USD", null, null], ["0010", "2022-09-02", "Firegrader", "USD", null, null], ["0011", "2022-09-27", "Steelhead (Deutsch)", "USD", null, "4701732399"],
  ["0012", "2022-10-17", "Firegrader", "USD", null, null], ["0048", "2022-11-11", "Tuzuu", "BRL", null, null], ["0049", "2022-11-15", "Steelhead (Deutsch)", "USD", null, "4701751173"],
  ["0050", "2022-12-15", "State Design", "USD", null, null], ["0051", "2023-01-03", "Joy", "USD", null, null], ["0052", "2023-04-24", "State Design", "USD", null, null],
  ["0053", "2023-05-30", "Steelhead (Deutsch)", "USD", null, "4701751173"], ["0054", "2023-08-11", "RGA", "USD", 2000, null],
  ["0079", "2024-11-01", "Steelhead (Deutsch)", "USD", 5400, null], ["0080", "2024-11-01", "Steelhead (Deutsch)", "USD", 1800, null],
  ["0089", "2025-05-08", "Steelhead (Deutsch)", "USD", 7000, "4702134214"], ["0100", "2025-04-10", "Lobo", "BRL", 19200, null], ["0101", "2025-04-10", "Lobo", "BRL", 19200, null],
]
for (const [seq, date, client, currency, total, po] of INTL) {
  const cid = await upsertClient({ name: client, legal_name: null, cnpj: null, address: null, notes: "Importado do histórico de invoices" })
  const jid = await historyJob(cid, client, currency)
  await insertInvoice({
    job_id: jid, invoice_number: `H-${seq}`, seq_number: seq, po_number: po, period_start: date, period_end: date, total_hours_billed: 0,
    subtotal: total ?? 0, tax_rate: 0, tax_amount: 0, total: total ?? 0, currency, sent_at: date, paid_at: date,
    nf_status: currency === "BRL" ? "issued" : "not_required", nf_amount_brl: currency === "BRL" ? total : null, notes: total == null ? "Valor não lido do PDF; completar" : null,
  })
}

// 3) 2025 spreadsheet rows 083–088
for (const r of csv("MaterialCliente/Acompanhamento de projetos - Sheet1.csv").filter(r => /^\d{3}$/.test(r[""] ?? r["﻿"] ?? ""))) {
  const seq = `0${r[""] ?? r["﻿"]}`; const client = r["Estudio/Agencia"] || "Desconhecido"
  const cid = await upsertClient({ name: canon(client), legal_name: client, cnpj: r.CNPJ || null, address: r["Endereço"] || null, notes: null })
  const jid = await historyJob(cid, canon(client), "BRL")
  const issued = isoFromUs(r["Emissão da NF"]); const start = isoFromUs(r["Início Job"]) ?? issued ?? "2025-01-01"
  await insertInvoice({
    job_id: jid, invoice_number: `H-${seq}`, seq_number: seq, period_start: start, period_end: issued ?? start, total_hours_billed: 0,
    subtotal: brl(r.Valor), tax_rate: 0, tax_amount: 0, total: brl(r.Valor), currency: "BRL",
    nf_status: issued ? "issued" : "pending", nf_series: issued ? "sao_paulo" : null, nf_issued_at: issued, nf_amount_brl: brl(r.Valor) || null,
    notes: [r.Cliente && `Cliente final: ${r.Cliente}`, r.Job && `Job: ${r.Job}`, r["Descrição do Job"]].filter(Boolean).join(" · ") || null,
  })
}
console.log("done", dry ? "(dry run)" : "")
```
Note on the spreadsheet: its first header cell is empty, so the sequence column key is `""` (or `"﻿"` if a BOM survives). The `r[""] ?? r["﻿"]` handles both. The `seq_number` for Paulínia rows is prefixed `NFP` so they do not collide with the invoice series; the gap detector ignores non-numeric prefixes only if you strip them — `findGaps` strips non-digits, so `NFP050` becomes 50 and would pollute the invoice gap list. Therefore in `nf-client.tsx` compute `seqGaps`/`seqDups` on `rows.filter(r => !r.seq_number?.startsWith("NFP"))`. Add that filter now.

- [ ] **Step 2: Dry run, then real run**

Run: `node scripts/import-nf-history.mjs --dry` and read the log (clients and invoices that would be created). Then `node scripts/import-nf-history.mjs`.
Expected: ~12 clients from Paulínia + ~10 international clients, 60 Paulínia invoices, 19 international, 6 from the spreadsheet; re-running prints only "skip (exists)".

- [ ] **Step 3: Verify in the UI**

`/notas-fiscais` shows Paulínia notes filtered by series; the invoice gap alert lists 13–47, 55–78, 81–82 (083–088 now exist), 90–99; `/clients` shows Videographica with CNPJ.

- [ ] **Step 4: Commit**

```bash
git add scripts/import-nf-history.mjs "src/app/(app)/notas-fiscais/nf-client.tsx"
git commit -m "feat: import historical NFs, invoices and clients from MaterialCliente"
```

---

### Task 13: Final verification and deploy

- [ ] **Step 1:** `npm test` → all green. `npx tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 2:** With the dev server running and a session cookie, fetch `/notas-fiscais`, `/invoices`, `/settings`, `/clients`, `/dashboard` → all 200 with the new content.
- [ ] **Step 3:** Push and deploy: `git push origin main && vercel deploy --prod --yes`. Smoke-test `/notas-fiscais` in production.
- [ ] **Step 4:** Report: what was built, the migration applied, the imported counts, and what the user must fill in (accountant e-mail, legal name, CCM, intermediary bank).
