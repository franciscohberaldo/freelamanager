# S01: Types & Bug Fixes — Research

**Date:** 2026-05-15
**Depth:** Targeted research — known technology (Supabase + TypeScript), moderately complex scope (27 tables, 15 `as any` instances, 1 currency bug).

## Summary

The slice addresses three requirements: R001 (currency bug), R002 (complete types.ts), R003 (zero `as any`). The codebase has **27 Supabase tables** defined across 11 migrations, but `src/lib/supabase/types.ts` only covers **8 tables**. This gap is the root cause of 15 `as any` casts scattered across 15 files — most cast query results because TypeScript can't infer relationship shapes from incomplete type definitions.

The currency bug in `PaymentDialog` is a simple prop-drilling fix: the component hardcodes `"BRL"` in two `Intl.NumberFormat` calls (lines 86, 91 of `invoice-actions.tsx`) but the parent already has `invoice.currency` available. A shared `formatCurrency(value, currency)` utility already exists in `src/lib/utils.ts:10`.

The natural build order is: types first (unblocks all downstream type fixes), then `as any` elimination file-by-file, then the currency bug fix. The currency fix is independent but benefits from having complete types for `InvoiceRow`.

## Recommendation

1. **Regenerate types.ts** from migrations to cover all 27 tables with Row/Insert types and relationship composites. Do this manually by reading each migration — Supabase CLI `gen types` would need a live DB connection.
2. **Eliminate `as any`** file by file — most are relationship casts that resolve once proper composite types exist (e.g., `JobWithClient`, `ProjectWithClient`).
3. **Fix PaymentDialog** — add `currency` prop, replace hardcoded `"BRL"`, use existing `formatCurrency` utility from `src/lib/utils.ts`.
4. **Remove `daily_journal` table type** if added — the diario feature is slated for removal per milestone scope.

## Implementation Landscape

### Key Files

- `src/lib/supabase/types.ts` — Central type definitions. Currently 8 tables; needs 19 more tables plus composite types for relationships.
- `src/app/(app)/invoices/invoice-actions.tsx` — PaymentDialog with hardcoded BRL at lines 86, 91. Parent passes `invoice.currency` at line 366-372.
- `src/lib/utils.ts` — Already has `formatCurrency(value, currency="BRL")` at line 10. Ready to use.
- `src/app/(app)/agenda/page.tsx:26` — `as any` on events array, needs `AgendaEvent[]` or composite type.
- `src/app/(app)/automacoes/page.tsx:31` — `as any` on jobs array.
- `src/app/(app)/automacoes/automacoes-client.tsx:217` — `(j.clients as any).name` — needs `JobWithClient` composite.
- `src/app/(app)/despesas/despesas-client.tsx:493` — `(entry as any)` on Recharts tooltip — may need Recharts-specific typing or a targeted suppression.
- `src/app/(app)/agenda/task-dialog.tsx:55-56` — `(task as any)?.recurrence` — migration 009 added `recurrence` and `recurrence_end` to `agenda_events` but types.ts doesn't reflect it.
- `src/app/(app)/clients/page.tsx:58` — `(client as any).score` — `score` field not in type.
- `src/app/(app)/clients/[id]/page.tsx:45` — `client as any` — client object missing relationship/computed fields.
- `src/app/(app)/invoices/page.tsx:87` — `jobs as any` in CreateInvoiceDialog.
- `src/app/(app)/logs/page.tsx:48-49` — `logs as any`, `jobs as any`.
- `src/app/(app)/projetos/page.tsx:28,30` — `projects as any`, `templates as any`.
- `src/app/(app)/projetos/projects-client.tsx:275` — `(p.clients as any).name`.
- `src/app/(app)/projetos/[id]/page.tsx:26` — `project as any`, `tasks as any`.
- `src/app/(app)/projetos/[id]/project-client.tsx:313` — `(project.clients as any).name`.
- `src/app/(app)/pipeline/pipeline-client.tsx:137` — `e.target.value as any` for form value.
- `src/app/(app)/diario/page.tsx:37-38` — `logs as any`, `jobs as any` (may be removed with diario).

### All 27 Tables (from migrations)

**Already typed (8):** clients, client_contacts, jobs, daily_logs, invoices, invoice_items, agenda_events, invoice_sequences

**Need types (19):** user_availability, projects, project_tasks, daily_journal, user_settings, expenses, invoice_payments, user_goals, project_task_items, project_templates, time_off, automation_settings, automation_log, sales_pipeline, client_interactions, client_portal_tokens, api_keys, webhooks, payment_links, webhook_deliveries

**Note:** `agenda_events` type needs updating — migration 009 added `recurrence`, `recurrence_end`, `recurrence_days` fields not in current type. `clients` may need a computed `score` field added.

### Build Order

1. **First: Complete `types.ts`** — Read all 11 migrations, add Row/Insert types for 19 missing tables, update `agenda_events` with recurrence fields, add composite types for relationships used in queries. This unblocks every other file.
2. **Second: Fix `as any` instances** — With complete types, most casts become unnecessary. Work file-by-file, updating Supabase query return types and component prop types. Group by pattern:
   - Relationship casts (`clients as any`).name → use composite types (6 instances)
   - Array casts on page data → match query select with proper type (7 instances)
   - Recurrence field access → fixed by updated AgendaEvent type (2 instances)
   - Recharts entry cast → may need targeted typing or inline type (1 instance)
   - Pipeline form value cast → proper form typing (1 instance)
3. **Third: Fix PaymentDialog currency** — Add `currency` prop, update caller, use `formatCurrency` from utils.

### Verification Approach

- `npx tsc --noEmit` — must compile clean with zero errors
- `grep -r "as any" src/` — must return zero matches (excluding node_modules)
- Visual check: create/view a USD invoice → PaymentDialog must show `$` not `R$`
- `npm run build` — full Next.js build must succeed

## Constraints

- No Supabase CLI access for `supabase gen types` — types must be manually derived from migration SQL files.
- `daily_journal` table: include type for now (diario removal is in a later slice or may be deferred). If diario page is removed in this slice, the type can be omitted.
- Recharts tooltip `entry` parameter has weak upstream typing — may need a narrow inline type rather than full elimination of `any`.
- Must not change Supabase queries or runtime behavior — this slice is types-only plus the currency display fix.

## Common Pitfalls

- **Relationship shapes vary by query** — A `select("*, clients(*)")` returns `{ clients: ClientRow }` while `select("*, clients(name)")` returns `{ clients: { name: string } }`. Composite types must match actual select shapes used in each file, or use a generic `Pick` pattern.
- **Nullable relationships** — Supabase returns `null` for LEFT JOIN misses. Composite types must use `ClientRow | null`, not just `ClientRow`.
- **Migration column alterations** — Later migrations ALTER tables (e.g., migration 002 adds columns to `agenda_events`). The final Row type must reflect the cumulative schema, not just the CREATE TABLE.
- **`score` on clients** — This appears to be a computed/virtual column (possibly from a Supabase function or view). Verify whether it's a real column or computed in JS before adding to type.

## Open Risks

- The `client.score` field at `clients/page.tsx:58` may be computed server-side (Supabase function/view) rather than a table column. If it's not in migrations, it needs investigation before typing.
- Some `as any` casts may reveal actual type mismatches between what the query returns and what the component expects — these are latent bugs that types will surface.
