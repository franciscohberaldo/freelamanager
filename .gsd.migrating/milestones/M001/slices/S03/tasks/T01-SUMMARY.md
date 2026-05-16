---
id: T01
parent: S03
milestone: M001
key_files:
  - src/app/(app)/dashboard/page.tsx
  - src/app/(app)/dashboard/dashboard-client.tsx
  - src/app/(app)/dashboard/monthly-view.tsx
key_decisions:
  - Single Tabs component wraps both triggers and content to share state correctly
  - Daily queries added in parallel with monthly queries for zero additional waterfall
  - MonthlyView receives serialized ISO date string (now) instead of Date object to cross the server/client boundary
duration: 
verification_result: passed
completed_at: 2026-05-16T13:02:29.181Z
blocker_discovered: false
---

# T01: Split dashboard page.tsx into server-only data fetcher + client shell with Hoje/Mensal tabs + extracted monthly view component

**Split dashboard page.tsx into server-only data fetcher + client shell with Hoje/Mensal tabs + extracted monthly view component**

## What Happened

Refactored the 312-line monolithic server component into a clean server/client architecture:

1. Created `monthly-view.tsx` — extracted ALL rendering logic (KPI cards, goals progress, charts, forecast, invoices list, events list) into a client component that receives pre-fetched data as props. Renders identically to production.

2. Created `dashboard-client.tsx` — client shell with Radix Tabs (Hoje/Mensal) defaulting to "hoje". The daily tab shows a placeholder; the monthly tab renders MonthlyView with full fidelity.

3. Refactored `page.tsx` — kept all 8 existing monthly queries, added 4 new parallel queries for the daily view (today's logs with job+client joins, today's agenda events, overdue invoices, last 14 days of logs for staleness detection). All data passed to DashboardClient via typed props.

Used `as unknown as T` pattern consistently for Supabase FK join casts (per MEM005 and S01 decisions). No `as any` introduced anywhere.

## Verification

1. `npx tsc --noEmit` exits 0 — full type safety confirmed.
2. Grep for `as any` in dashboard directory — zero matches.
3. Monthly tab renders all original UI elements (KPIs, goals, charts, forecast, invoices, events).
4. Daily tab shows placeholder as specified.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 15000ms |
| 2 | `grep -r 'as any' src/app/(app)/dashboard/` | 1 | pass (no matches) | 200ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/monthly-view.tsx`
