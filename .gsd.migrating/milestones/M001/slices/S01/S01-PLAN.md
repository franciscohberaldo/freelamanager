# S01: Types & Bug Fixes

**Goal:** Complete TypeScript types for all 27 Supabase tables, eliminate every `as any` cast in the codebase, and fix the PaymentDialog currency bug so it respects the invoice's currency instead of hardcoding BRL.
**Demo:** Registrar pagamento em invoice USD — mostra valor em USD, não BRL. Build compila sem `as any`.

## Must-Haves

- `npx tsc --noEmit` compiles clean with zero errors. `grep -r "as any" src/` returns zero matches. PaymentDialog formats amounts using `invoice.currency` (USD shows $, EUR shows €, BRL shows R$). `npm run build` succeeds.

## Proof Level

- This slice proves: contract — types are verified at compile time; currency fix is verified visually and by build success.

## Integration Closure

Upstream surfaces consumed: 11 migration SQL files define the canonical schema. New wiring: none — this slice only changes type definitions and display formatting, no new runtime behavior. What remains: S02-S06 consume the complete types produced here.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [ ] **T01: Complete types.ts with all 27 tables and composite types** `est:1h`
  Why: Only 8 of 27 Supabase tables have TypeScript types in `src/lib/supabase/types.ts`. This causes 15 files to use `as any` casts because TypeScript can't infer query return shapes. Every downstream fix depends on having complete types first.
  - Files: `src/lib/supabase/types.ts`
  - Verify: npx tsc --noEmit

- [ ] **T02: Eliminate all as-any casts and fix PaymentDialog currency bug** `est:1h30m`
  Why: 15 files use `as any` casts because types were incomplete (R002/R003). The PaymentDialog hardcodes BRL for currency formatting instead of using the invoice's actual currency (R001). With T01's complete types, every cast can be replaced with the correct type.
  - Files: `src/app/(app)/agenda/page.tsx`, `src/app/(app)/agenda/task-dialog.tsx`, `src/app/(app)/automacoes/page.tsx`, `src/app/(app)/automacoes/automacoes-client.tsx`, `src/app/(app)/clients/page.tsx`, `src/app/(app)/clients/[id]/page.tsx`, `src/app/(app)/despesas/despesas-client.tsx`, `src/app/(app)/diario/page.tsx`, `src/app/(app)/invoices/page.tsx`, `src/app/(app)/invoices/invoice-actions.tsx`, `src/app/(app)/logs/page.tsx`, `src/app/(app)/pipeline/pipeline-client.tsx`, `src/app/(app)/projetos/page.tsx`, `src/app/(app)/projetos/projects-client.tsx`, `src/app/(app)/projetos/[id]/page.tsx`, `src/app/(app)/projetos/[id]/project-client.tsx`
  - Verify: npx tsc --noEmit

## Files Likely Touched

- src/lib/supabase/types.ts
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
