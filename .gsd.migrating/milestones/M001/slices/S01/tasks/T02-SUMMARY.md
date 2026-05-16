---
id: T02
parent: S01
milestone: M001
key_files:
  - src/app/(app)/agenda/page.tsx
  - src/app/(app)/agenda/task-dialog.tsx
  - src/app/(app)/automacoes/page.tsx
  - src/app/(app)/automacoes/automacoes-client.tsx
  - src/app/(app)/clients/page.tsx
  - src/app/(app)/clients/[id]/page.tsx
  - src/app/(app)/despesas/despesas-client.tsx
  - src/app/(app)/diario/page.tsx
  - src/app/(app)/invoices/page.tsx
  - src/app/(app)/invoices/invoice-actions.tsx
  - src/app/(app)/logs/page.tsx
  - src/app/(app)/pipeline/pipeline-client.tsx
  - src/app/(app)/projetos/page.tsx
  - src/app/(app)/projetos/projects-client.tsx
  - src/app/(app)/projetos/[id]/page.tsx
  - src/app/(app)/projetos/[id]/project-client.tsx
key_decisions:
  - Used `as unknown as T` for Supabase FK join type mismatches (array vs object) — explicit target type is safer than `as any` while acknowledging the Supabase type generation limitation
  - Used formatCurrency utility from lib/utils for PaymentDialog instead of inline Intl.NumberFormat — consistent with rest of codebase
  - For Recharts tooltip entry, used narrow payload type assertion `(entry.payload as { value?: number })` rather than suppressing the whole expression
duration: 
verification_result: passed
completed_at: 2026-05-16T12:34:33.600Z
blocker_discovered: false
---

# T02: Eliminated all 18 `as any` casts across 15 files and fixed PaymentDialog currency bug to use invoice's actual currency instead of hardcoding BRL

**Eliminated all 18 `as any` casts across 15 files and fixed PaymentDialog currency bug to use invoice's actual currency instead of hardcoding BRL**

## What Happened

Removed all `as any` casts from the codebase using three strategies based on the root cause of each cast:

1. **Direct removal** (where T01's new types made the cast unnecessary): `task-dialog.tsx` (recurrence fields now on AgendaEventRow), `clients/page.tsx` (score now on ClientRow), `automacoes-client.tsx`/`projects-client.tsx`/`project-client.tsx` (accessing `.clients.name` directly since the local interface already declared it correctly).

2. **Narrow type assertions via `as unknown as T`** (where Supabase's generated types incorrectly represent many-to-one FK joins as arrays instead of single objects): `automacoes/page.tsx`, `diario/page.tsx`, `invoices/page.tsx`, `logs/page.tsx`. These use explicit target types matching the client component interfaces — not `as any`.

3. **Targeted type narrowing** (where the type was legitimately untyped): `despesas-client.tsx` Recharts tooltip entry uses `(entry.payload as { value?: number })` instead of `as any`. `pipeline-client.tsx` simply removed the cast since `e.target.value` is already a string matching the form field type.

4. **PaymentDialog currency fix (R001)**: Added `currency: string` prop to the component, replaced two hardcoded `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` calls with `formatCurrency(value, currency)` from `@/lib/utils`, and updated the caller to pass `currency={invoice.currency}`.

## Verification

Ran `grep -rn "as any" src/` — zero matches. Ran `npx tsc --noEmit` — exit code 0 (zero errors). Ran `npx next build` — successful build with all pages compiling correctly.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |
| 2 | `grep -rn 'as any' src/` | 1 | pass (no matches) | 100ms |
| 3 | `npx next build` | 0 | pass | 45000ms |

## Deviations

none

## Known Issues

Supabase generated types represent many-to-one FK joins (e.g. `clients(name)`) as arrays instead of single objects. This is a known Supabase codegen limitation. The `as unknown as T` casts in server pages are the correct workaround until Supabase improves their type inference for foreign key relationships or the project adds proper Relationships declarations to the Database type.

## Files Created/Modified

- `src/app/(app)/agenda/page.tsx`
- `src/app/(app)/agenda/task-dialog.tsx`
- `src/app/(app)/automacoes/page.tsx`
- `src/app/(app)/automacoes/automacoes-client.tsx`
- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/[id]/page.tsx`
- `src/app/(app)/despesas/despesas-client.tsx`
- `src/app/(app)/diario/page.tsx`
- `src/app/(app)/invoices/page.tsx`
- `src/app/(app)/invoices/invoice-actions.tsx`
- `src/app/(app)/logs/page.tsx`
- `src/app/(app)/pipeline/pipeline-client.tsx`
- `src/app/(app)/projetos/page.tsx`
- `src/app/(app)/projetos/projects-client.tsx`
- `src/app/(app)/projetos/[id]/page.tsx`
- `src/app/(app)/projetos/[id]/project-client.tsx`
