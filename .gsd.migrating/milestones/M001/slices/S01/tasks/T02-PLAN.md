---
estimated_steps: 25
estimated_files: 16
skills_used: []
---

# T02: Eliminate all as-any casts and fix PaymentDialog currency bug

Why: 15 files use `as any` casts because types were incomplete (R002/R003). The PaymentDialog hardcodes BRL for currency formatting instead of using the invoice's actual currency (R001). With T01's complete types, every cast can be replaced with the correct type.

Do:
1. Fix each file's `as any` casts using the composite and row types from T01. The 15 files and their patterns:
   - `src/app/(app)/agenda/page.tsx` — cast events array → `AgendaEventWithJob[]`
   - `src/app/(app)/agenda/task-dialog.tsx` — `(task as any)?.recurrence` → access directly since `AgendaEventRow` now has `recurrence`
   - `src/app/(app)/automacoes/page.tsx` — cast jobs array → `Job[]`
   - `src/app/(app)/automacoes/automacoes-client.tsx` — `(j.clients as any).name` → use `JobWithClient` type
   - `src/app/(app)/clients/page.tsx` — `(client as any).score` → `ClientRow` now has `score`
   - `src/app/(app)/clients/[id]/page.tsx` — `client as any` → proper composite type
   - `src/app/(app)/despesas/despesas-client.tsx` — Recharts tooltip `(entry as any)` → define inline Recharts entry type or narrow type assertion
   - `src/app/(app)/diario/page.tsx` — `logs as any`, `jobs as any` → `DailyLogWithJob[]`, `Job[]`
   - `src/app/(app)/invoices/page.tsx` — `jobs as any` → `Job[]` or `JobWithClient[]`
   - `src/app/(app)/logs/page.tsx` — `logs as any`, `jobs as any` → proper types
   - `src/app/(app)/pipeline/pipeline-client.tsx` — `e.target.value as any` → proper HTMLSelectElement typing
   - `src/app/(app)/projetos/page.tsx` — `projects as any`, `templates as any` → `ProjectWithClient[]`, `ProjectTemplate[]`
   - `src/app/(app)/projetos/projects-client.tsx` — `(p.clients as any).name` → `ProjectWithClient`
   - `src/app/(app)/projetos/[id]/page.tsx` — `project as any`, `tasks as any` → proper composite types
   - `src/app/(app)/projetos/[id]/project-client.tsx` — `(project.clients as any).name` → `ProjectWithClient`
2. Fix PaymentDialog currency bug (R001) in `src/app/(app)/invoices/invoice-actions.tsx`:
   - Add `currency: string` prop to `PaymentDialog` component signature.
   - Replace the two hardcoded `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })` calls (lines 86, 91) with `formatCurrency(value, currency)` from `src/lib/utils.ts`.
   - Update the caller at line 366-372 to pass `currency={invoice.currency}`.
3. For the Recharts tooltip cast in despesas-client.tsx, define a narrow inline type (e.g., `{ name: string; value: number; [key: string]: unknown }`) if Recharts types don't provide a clean alternative. A targeted type narrowing is acceptable here — do NOT use `as any`.
4. For `pipeline-client.tsx`, use `(e.target as HTMLSelectElement).value` with proper DOM typing instead of `as any`.

Done when: `grep -rn "as any" src/` returns zero matches. `npx tsc --noEmit` passes. `npm run build` succeeds. PaymentDialog accepts a `currency` prop and formats amounts accordingly.

## Inputs

- `src/lib/supabase/types.ts`
- `src/lib/utils.ts`
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

## Expected Output

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

## Verification

npx tsc --noEmit
