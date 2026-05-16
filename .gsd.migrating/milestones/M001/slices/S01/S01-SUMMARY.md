---
id: S01
parent: M001
milestone: M001
provides:
  - Complete TypeScript types in src/lib/supabase/types.ts covering all 28 Supabase tables with Row/Insert/Update shapes
  - Zero as-any casts — all queries fully typed across 15 files
  - PaymentDialog correctly formats amounts using invoice.currency
requires:
  []
affects:
  - S02
  - S03
  - S04
  - S05
  - S06
key_files:
  - src/lib/supabase/types.ts
  - src/app/(app)/invoices/invoice-actions.tsx
key_decisions:
  - Used union literal types for enum columns matching SQL CHECK constraints
  - Used as unknown as T for Supabase FK join type mismatches (safer than as any)
  - Used formatCurrency utility from lib/utils for PaymentDialog (consistent with codebase)
patterns_established:
  - as unknown as TargetType for Supabase FK join array-vs-object mismatches
  - Row/Insert/Update shape triple for every table type
  - Composite types (e.g. ProjectWithClient) for joined query results
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S01/tasks/T02-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-16T12:36:34.211Z
blocker_discovered: false
---

# S01: Types & Bug Fixes

**Complete TypeScript types for all 28 Supabase tables, eliminated all 18 `as any` casts across 15 files, and fixed PaymentDialog to format amounts in the invoice's actual currency instead of hardcoding BRL**

## What Happened

T01 added complete TypeScript type definitions for all 28 Supabase tables (27 from migrations + invoice_sequences) to `src/lib/supabase/types.ts`. Each table got Row/Insert/Update shapes with union literal types for enum columns matching SQL CHECK constraints. AgendaEvent gained recurrence fields, Client gained score, and composite types (ProjectWithClient, ProjectWithTasks, ProjectTaskWithItems) were added proactively for downstream use.

T02 then leveraged the complete types to eliminate all 18 `as any` casts across 15 source files. For Supabase FK join type mismatches (arrays vs objects), the pattern `as unknown as T` was used — explicit target type is safer than `as any` while acknowledging the Supabase codegen limitation. The PaymentDialog currency bug was fixed by switching from hardcoded BRL to using `invoice.currency` with the existing `formatCurrency` utility from `src/lib/utils.ts`, making USD show $, EUR show €, and BRL show R$ correctly.

## Verification

All three verification checks pass:\n1. `grep -rn "as any" src/` — zero matches (was 18)\n2. `npx tsc --noEmit` — exit code 0, zero type errors\n3. `npx next build` — successful production build, all pages compile correctly

## Requirements Advanced

- R001 — PaymentDialog now uses invoice.currency with formatCurrency utility instead of hardcoding BRL
- R002 — types.ts covers all 28 Supabase tables with full Row/Insert/Update shapes
- R003 — All 18 as-any casts eliminated across 15 files, grep returns zero matches

## Requirements Validated

- R001 — PaymentDialog code uses formatCurrency(amount, invoice.currency) — build succeeds confirming type safety
- R002 — npx tsc --noEmit exits 0; 28 table entries verified in Database type map
- R003 — grep -rn 'as any' src/ returns zero matches; npx tsc --noEmit exits 0

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

Task plan stated 27 tables but actual count is 28 — invoice_sequences was already present in the original file and is a real table from migrations. All 28 are included.

## Known Limitations

Supabase codegen represents many-to-one FK joins as arrays instead of single objects. The `as unknown as T` casts are the correct workaround until Supabase improves their type inference or the project adds explicit Relationships declarations to the Database type.

## Follow-ups

none

## Files Created/Modified

- `src/lib/supabase/types.ts` — Complete types for all 28 tables with Row/Insert/Update shapes, composite types for project queries
- `src/app/(app)/agenda/page.tsx` — Replaced as any with proper AgendaEventRow type
- `src/app/(app)/agenda/task-dialog.tsx` — Replaced as any with typed task data
- `src/app/(app)/automacoes/page.tsx` — Replaced as any with AutomationRow type
- `src/app/(app)/automacoes/automacoes-client.tsx` — Replaced as any with AutomationRow type
- `src/app/(app)/clients/page.tsx` — Replaced as any with ClientRow type
- `src/app/(app)/clients/[id]/page.tsx` — Replaced as any with typed client + relations
- `src/app/(app)/despesas/despesas-client.tsx` — Replaced as any with ExpenseRow type
- `src/app/(app)/diario/page.tsx` — Replaced as any with DailyLogRow type
- `src/app/(app)/invoices/page.tsx` — Replaced as any with InvoiceRow type
- `src/app/(app)/invoices/invoice-actions.tsx` — Replaced as any + fixed PaymentDialog currency to use invoice.currency
- `src/app/(app)/logs/page.tsx` — Replaced as any with DailyLogRow type
- `src/app/(app)/pipeline/pipeline-client.tsx` — Replaced as any with DealRow type
- `src/app/(app)/projetos/page.tsx` — Replaced as any with ProjectRow type
- `src/app/(app)/projetos/projects-client.tsx` — Replaced as any with ProjectRow type
- `src/app/(app)/projetos/[id]/page.tsx` — Replaced as any with ProjectWithClient composite type
- `src/app/(app)/projetos/[id]/project-client.tsx` — Replaced as any with typed project data
