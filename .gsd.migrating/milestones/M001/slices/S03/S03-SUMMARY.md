---
id: S03
parent: M001
milestone: M001
provides:
  - Daily dashboard view with KPI cards, agenda, overdue invoices, and goal progress
  - Revenue-at-risk widget (overdue invoices + stale jobs)
  - Server/client split pattern for dashboard with parallel Supabase queries
  - Hoje/Mensal tab switching via shadcn Tabs
requires:
  - slice: S01
    provides: Types completos para queries do dashboard (daily_logs, agenda_tasks, invoices, jobs, goals)
affects:
  - S04
key_files:
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/dashboard/dashboard-client.tsx
  - src/app/(app)/dashboard/daily-view.tsx
  - src/app/(app)/dashboard/monthly-view.tsx
  - src/app/(app)/dashboard/revenue-at-risk.tsx
key_decisions:
  - Server/client split: page.tsx is pure server data-fetcher, dashboard-client.tsx is client shell with Tabs
  - Daily queries run in parallel with monthly queries — zero additional waterfall
  - Serialized ISO date string crosses server/client boundary instead of Date object
  - Revenue-at-risk widget always renders (positive empty state) to keep layout stable
  - Stale job threshold: 14 days matching existing recentDailyLogs query window
  - Two-tone goal progress bars: lighter segment for prior month, darker for today's contribution
  - 3-column KPI grid for daily view (hours, tasks, invoices) vs 4-column for monthly
patterns_established:
  - Server/client split pattern: server page.tsx fetches + serializes, client component receives props and handles interactivity
  - Supabase FK join array casting via as unknown as T (MEM005 gotcha)
  - Currency-aware formatting via formatCurrency(amount, currency_code) throughout dashboard
observability_surfaces:
  - none — client-side dashboard with server-rendered data; failures surface as Supabase query errors in server logs
drill_down_paths:
  - .gsd/milestones/M001/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S03/tasks/T04-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-16T13:12:41.596Z
blocker_discovered: false
---

# S03: Dashboard do Dia

**Daily dashboard with KPI cards (hours, tasks, invoices), agenda, overdue invoices, revenue-at-risk widget, goal progress, and instant Hoje/Mensal tab switching**

## What Happened

The existing ~312-line server-component dashboard was refactored into a server/client split architecture to support client-side tab switching between daily and monthly views.

**T01 — Server/client split with Tabs:** page.tsx was reduced to a pure server data-fetcher that runs daily and monthly Supabase queries in parallel, then passes serialized results to dashboard-client.tsx. The monthly rendering logic was extracted into monthly-view.tsx. A shadcn Tabs component wraps both "Hoje" and "Mensal" triggers and content panels, defaulting to the daily view.

**T02 — Daily view with KPIs and agenda:** daily-view.tsx was built with a 3-column KPI grid (hours today, tasks today, overdue invoices), an agenda section showing today's tasks, an overdue invoice list with currency-aware formatting, and goal progress bars using a two-tone segment design (lighter for prior month progress, darker for today's contribution). Supabase FK join arrays are cast via `as unknown as T` per the established MEM005 gotcha pattern.

**T03 — Revenue-at-risk widget:** revenue-at-risk.tsx surfaces "money that might slip away" by combining overdue invoice totals (grouped by currency) with active jobs that have no daily_log entry in the past 14 days. The widget always renders — showing a positive empty state when no risk exists — to maintain stable dashboard layout. Rate display prefers daily_rate over hourly_rate with formatCurrency for consistent formatting.

**T04 — Visual polish and build verification:** Final integration verified that both tabs render correctly, the build succeeds (7.61 kB for /dashboard), and TypeScript compiles with zero errors. No additional visual changes were needed — T01-T03 had already applied consistent styling patterns.

## Verification

1. `npx tsc --noEmit` — exit 0, zero type errors across all dashboard files
2. `npx next build` — success, /dashboard compiled at 7.61 kB (233 kB first load)
3. `grep -rn "as any" src/app/(app)/dashboard/` — zero matches, no type safety escape hatches
4. File inventory confirmed: page.tsx (5.5 kB server fetcher), dashboard-client.tsx (1 kB client shell), daily-view.tsx (12.6 kB), monthly-view.tsx (11.6 kB), revenue-at-risk.tsx (4.9 kB)
5. Dev server smoke test (from T04): GET /dashboard returned HTTP 200, both Hoje and Mensal tabs render

## Requirements Advanced

- R006 — Dashboard defaults to Hoje tab with daily KPIs (hours, tasks, overdue invoices), agenda, goal progress. Mensal tab preserves original monthly view. Tab switching is client-side instant.
- R007 — Revenue-at-risk widget in daily view shows overdue invoice totals grouped by currency + stale active jobs with no daily_log in 14 days.

## Requirements Validated

- R006 — tsc --noEmit exit 0, next build success (7.61 kB), dev server HTTP 200, both tabs render with correct data
- R007 — tsc --noEmit exit 0, next build success, code review confirms formatCurrency per-invoice currency, widget always renders with positive empty state

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

none

## Known Limitations

Daily view goal progress bars show month-to-date progress — there is no weekly or quarterly view yet. Revenue-at-risk widget uses a fixed 14-day stale threshold that is not user-configurable (would belong in S04 settings or a future slice).

## Follow-ups

none — all planned functionality delivered as specified

## Files Created/Modified

- `src/app/(app)/dashboard/page.tsx` — Refactored from 312-line monolith to ~100-line server data-fetcher with parallel daily+monthly Supabase queries
- `src/app/(app)/dashboard/dashboard-client.tsx` — New client shell with shadcn Tabs routing to DailyView/MonthlyView, defaults to Hoje tab
- `src/app/(app)/dashboard/daily-view.tsx` — New daily dashboard: 3 KPI cards, agenda section, overdue invoices list, goal progress bars with today's contribution
- `src/app/(app)/dashboard/monthly-view.tsx` — Extracted monthly dashboard rendering from original page.tsx, preserving all original UI elements
- `src/app/(app)/dashboard/revenue-at-risk.tsx` — New revenue-at-risk widget: overdue invoice totals by currency + stale active jobs (14-day threshold)
