# S03: Dashboard do Dia

**Goal:** Abrir o app mostra horas de hoje, tarefas da agenda, invoices vencidas, receita em risco, progresso das metas. Toggle alterna pra visao mensal.
**Demo:** Abrir o app mostra horas de hoje, tarefas da agenda, invoices vencidas, receita em risco, progresso das metas. Toggle alterna pra visao mensal.

## Must-Haves

- 1. Default tab is "Hoje" showing daily KPIs (hours today, today's agenda tasks, overdue invoices)\n2. Revenue-at-risk widget shows overdue invoice totals + stale active jobs (no log in 14 days)\n3. Monthly goal progress bars visible in daily view with today's contribution\n4. "Mensal" tab renders current monthly dashboard identically to pre-refactor\n5. Tab switching is instant (client-side, no page reload)\n6. All text in Portuguese (BR), code in English\n7. npx tsc --noEmit exits 0\n8. npx next build succeeds

## Proof Level

- This slice proves: integration — real Supabase queries on server, client-side tab switching, visual verification in browser

## Integration Closure

Upstream: S01 types (src/lib/supabase/types.ts) for all query return shapes. New wiring: page.tsx fetches daily+monthly data, passes to dashboard-client.tsx which routes to daily-view or monthly-view via Tabs. Remaining for milestone: S04 (timer/notifications), S05 (command palette), S06 (client portal).

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Refactor page.tsx into server+client shell with Tabs** `est:1h30m`
  **Why:** The current page.tsx is a ~312-line server component rendering monthly data. Adding a daily/monthly toggle requires client state (Tabs), which can't live in a server component. We need to split data fetching (server) from rendering (client) and extract the monthly view into its own file.
  - Files: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/dashboard/dashboard-client.tsx`, `src/app/(app)/dashboard/monthly-view.tsx`
  - Verify: npx tsc --noEmit

- [x] **T02: Build daily view with KPI cards, agenda, and overdue invoices** `est:1h30m`
  **Why:** The daily view (R006) is the primary user loop — freelancer opens the app and needs to see hours today, today's tasks, and overdue invoices in 5 seconds.
  - Files: `src/app/(app)/dashboard/daily-view.tsx`, `src/app/(app)/dashboard/dashboard-client.tsx`
  - Verify: npx tsc --noEmit

- [x] **T03: Build revenue-at-risk widget (R007)** `est:1h`
  **Why:** R007 differentiator — freelancer loses money by not tracking overdue invoices and abandoned jobs. This widget surfaces 'money that might slip away' by combining overdue invoice totals with active jobs that have no recent daily_log.
  - Files: `src/app/(app)/dashboard/revenue-at-risk.tsx`, `src/app/(app)/dashboard/daily-view.tsx`
  - Verify: npx tsc --noEmit

- [x] **T04: Visual polish, build verification, and browser smoke test** `est:45m`
  **Why:** Final integration task — ensure the complete dashboard works end-to-end, both tabs render correctly, the build succeeds, and there are no TypeScript errors or visual regressions.
  - Files: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/dashboard/dashboard-client.tsx`, `src/app/(app)/dashboard/daily-view.tsx`, `src/app/(app)/dashboard/monthly-view.tsx`, `src/app/(app)/dashboard/revenue-at-risk.tsx`
  - Verify: npx next build

## Files Likely Touched

- src/app/(app)/dashboard/page.tsx
- src/app/(app)/dashboard/dashboard-client.tsx
- src/app/(app)/dashboard/monthly-view.tsx
- src/app/(app)/dashboard/daily-view.tsx
- src/app/(app)/dashboard/revenue-at-risk.tsx
