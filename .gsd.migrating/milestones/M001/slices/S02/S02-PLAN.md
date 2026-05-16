# S02: Consolidar Navegacao

**Goal:** Sidebar consolidada de 16 para 9 itens. Agenda mostra abas Disponibilidade/Folgas. Clientes mostra aba Pipeline. Journaling removido. Folga criada marca dia como indisponível.
**Demo:** Sidebar tem 9 itens. Agenda mostra abas Tarefas/Disponibilidade/Folgas. Clientes mostra aba Pipeline. Folga criada aparece como indisponivel.

## Must-Haves

- 1. navItems array in sidebar.tsx has exactly 9 entries\n2. /agenda renders tabs for Disponibilidade and Folgas alongside existing views\n3. /clients renders Pipeline tab with full Kanban board\n4. grep for journal-client, DailyJournal, diary_entries returns zero hits in src/\n5. Creating a folga upserts user_availability for that date range\n6. npx tsc --noEmit exits 0\n7. npx next build succeeds

## Proof Level

- This slice proves: integration — real UI composition verified via build + type-check

## Integration Closure

Consumes S01's complete types from src/lib/supabase/types.ts. Produces the consolidated sidebar (9 items) that S04 depends on for badge placement. Agenda page becomes the single surface for task scheduling + availability + time-off.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Remove journaling feature and clean all references** `est:20m`
  Why: R004 — daily_journal/mood is dead code that clutters sidebar and types. The /diario route serves work tracking (TrackingClient), not journaling.
  - Files: `src/app/(app)/diario/journal-client.tsx`, `src/components/layout/sidebar.tsx`, `src/components/command-palette.tsx`, `src/app/api/export/route.ts`, `src/lib/supabase/types.ts`
  - Verify: npx tsc --noEmit

- [ ] **T02: Consolidate Agenda page with Disponibilidade and Folgas tabs** `est:45m`
  Why: R005 — Disponibilidade and Folgas are currently standalone routes that fragment the scheduling experience. Both belong as tabs in the Agenda page, which already demonstrates the Tabs pattern with 4 views.
  - Files: `src/app/(app)/agenda/page.tsx`, `src/app/(app)/agenda/agenda-client.tsx`, `src/app/(app)/disponibilidade/availability-client.tsx`, `src/app/(app)/folgas/folgas-client.tsx`
  - Verify: npx tsc --noEmit

- [ ] **T03: Consolidate Clients page with Pipeline tab** `est:40m`
  Why: R005 — Pipeline is a CRM view tied to clients. Embedding it as a tab in /clients reduces sidebar items and co-locates related concerns.
  - Files: `src/app/(app)/clients/page.tsx`, `src/app/(app)/clients/clients-page-client.tsx`, `src/app/(app)/pipeline/pipeline-client.tsx`
  - Verify: npx tsc --noEmit

- [ ] **T04: Reduce sidebar to 9 items and update command palette** `est:20m`
  Why: R005 final — after T01-T03, merged routes are accessible via tabs. Remove their standalone sidebar entries to reach exactly 9 items. Update command palette to match.
  - Files: `src/components/layout/sidebar.tsx`, `src/components/command-palette.tsx`
  - Verify: npx tsc --noEmit

- [ ] **T05: Folgas blocks disponibilidade — auto-update user_availability on time_off insert** `est:25m`
  Why: R008 — currently folgas and disponibilidade are disconnected. A freelancer can appear available on a day they marked as folga. After creating a folga, the system must mark that day as unavailable.
  - Files: `src/app/(app)/folgas/folgas-client.tsx`
  - Verify: npx tsc --noEmit

## Files Likely Touched

- src/app/(app)/diario/journal-client.tsx
- src/components/layout/sidebar.tsx
- src/components/command-palette.tsx
- src/app/api/export/route.ts
- src/lib/supabase/types.ts
- src/app/(app)/agenda/page.tsx
- src/app/(app)/agenda/agenda-client.tsx
- src/app/(app)/disponibilidade/availability-client.tsx
- src/app/(app)/folgas/folgas-client.tsx
- src/app/(app)/clients/page.tsx
- src/app/(app)/clients/clients-page-client.tsx
- src/app/(app)/pipeline/pipeline-client.tsx
