---
id: T03
parent: S03
milestone: M001
key_files:
  - src/app/(app)/dashboard/revenue-at-risk.tsx
  - src/app/(app)/dashboard/daily-view.tsx
  - src/app/(app)/dashboard/page.tsx
key_decisions:
  - Stale job threshold set at 14 days matching the recentDailyLogs query window already in page.tsx
  - Rate display prefers daily_rate over hourly_rate when both exist, with formatCurrency for consistent formatting
  - Widget always renders (shows positive empty state when no risk) rather than conditionally hiding — keeps the dashboard layout stable
duration: 
verification_result: passed
completed_at: 2026-05-16T13:06:22.505Z
blocker_discovered: false
---

# T03: Built revenue-at-risk widget combining overdue invoice totals (grouped by currency) with stale active jobs (no daily_log in 14 days), integrated into daily dashboard view

**Built revenue-at-risk widget combining overdue invoice totals (grouped by currency) with stale active jobs (no daily_log in 14 days), integrated into daily dashboard view**

## What Happened

Created `revenue-at-risk.tsx` as a client component that receives overdue invoices, active jobs, and recent daily logs as props. The widget computes stale jobs by checking each active job against the last 14 days of daily_log entries — jobs with no log in that window are flagged as stale.

The widget renders two sections when risk exists: (1) "Invoices vencidos" showing overdue totals grouped by currency using formatCurrency, and (2) "Jobs sem atividade recente" listing each stale job with name, client name (via FK join), rate (daily_rate preferred, hourly_rate fallback), and days since last log.

When no risk exists (no overdue invoices and no stale jobs), a positive empty state shows "Tudo em dia!" with a CheckCircle icon.

Updated `page.tsx` to add `daily_rate` to the activeJobs select query and pass both `activeJobs` and `recentDailyLogs` through to the daily view props. Updated `daily-view.tsx` to accept the new props and render the RevenueAtRisk widget between the overdue invoices card and goal progress section.

## Verification

Ran `npx tsc --noEmit` — exited 0 with no errors. All new types align with existing Supabase schema (daily_rate confirmed in types.ts). Props flow correctly from server page through dashboard-client to daily-view to revenue-at-risk widget.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/app/(app)/dashboard/revenue-at-risk.tsx`
- `src/app/(app)/dashboard/daily-view.tsx`
- `src/app/(app)/dashboard/page.tsx`
