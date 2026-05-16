# S03 Research — Dashboard do Dia

## Summary

The current dashboard at `src/app/(app)/dashboard/page.tsx` is a **server component** (~312 lines) that renders a monthly overview. It makes 8 parallel Supabase queries via `Promise.all`: monthly daily_logs, active jobs, recent invoices (limit 5), upcoming agenda_events, all-time daily_logs for charts, monthly expenses, user_goals for the current month, and forecast logs (last 8 months). It renders 4 KPI cards (revenue, hours, expenses, pending invoices), optional goal progress bars (revenue_month, hours_month), two recharts client components (`DashboardCharts` and `ForecastChart`), and a bottom grid with recent invoices and upcoming events. The page imports from `date-fns`, `lucide-react`, and local UI primitives (`Card`, `Badge`). There is no daily view or toggle mechanism today — everything is month-scoped.

The slice requires transforming this into a **dual-view dashboard**: daily view (default) and monthly view (current content). The daily view needs: hours logged today, today's agenda tasks, overdue invoices, revenue-at-risk widget (R007), and goal progress. The toggle mechanism can leverage the existing `Tabs` component (`@radix-ui/react-tabs`) already installed and available at `src/components/ui/tabs.tsx`. Since the page is currently a server component and the toggle requires client-side state, the architecture must split into a server component that fetches ALL data (both daily and monthly) and a client component that handles the tab switching and renders the appropriate view.

The "revenue at risk" widget (R007) is a new concept — it combines overdue invoices (status = 'overdue') with active jobs that have no recent daily_log entries (e.g., no log in the last 7-14 days). This requires a new query pattern: joining `jobs` (status = 'active') with a subquery or post-fetch filter on `daily_logs` to identify "stale" jobs. The invoice table already has `status: 'overdue'` and `due_date` fields, and the codebase already queries overdue invoices in the billing-reminders cron (`src/app/api/cron/billing-reminders/route.ts`).

## Recommendation

Split the implementation into 4-5 tasks:

1. **Refactor page.tsx into server+client architecture** — server fetches all data, client component manages tab state
2. **Build daily view widgets** — hours today, today's agenda, overdue invoices card
3. **Build revenue-at-risk widget (R007)** — new component combining overdue invoice totals + stale active jobs
4. **Build daily goal progress** — adapt existing goal progress bars for daily context (show monthly progress with today's contribution highlighted)
5. **Wire toggle and preserve monthly view** — wrap existing monthly content in the "Mensal" tab, daily content in "Hoje" tab, default to "Hoje"

Use `Tabs` (not `Switch`) for the toggle — it provides clear visual affordance for two distinct views and is already in the component library.

## Implementation Landscape

### Key Files

| File | Role | Change needed |
|------|------|---------------|
| `src/app/(app)/dashboard/page.tsx` | Server component, data fetching | Add daily queries (today's logs, today's events, overdue invoices, stale jobs); pass all data to new client component |
| `src/app/(app)/dashboard/dashboard-client.tsx` | **NEW** — Client component | Manages Tabs state ("hoje"/"mensal"), renders daily or monthly view |
| `src/app/(app)/dashboard/daily-view.tsx` | **NEW** — Daily view content | Hours today card, today's agenda list, overdue invoices list, revenue-at-risk widget, goal progress |
| `src/app/(app)/dashboard/monthly-view.tsx` | **NEW** — Monthly view content | Extracted from current page.tsx (KPI cards, charts, invoices, events) |
| `src/app/(app)/dashboard/revenue-at-risk.tsx` | **NEW** — R007 widget | Client component showing overdue invoice total + stale jobs value |
| `src/app/(app)/dashboard/dashboard-charts.tsx` | Recharts client component | No change needed — consumed by monthly view |
| `src/app/(app)/dashboard/forecast-chart.tsx` | Recharts client component | No change needed — consumed by monthly view |
| `src/lib/supabase/types.ts` | Type definitions | No change needed — all required types exist (DailyLogRow, AgendaEventRow, InvoiceRow, JobRow, UserGoalRow) |
| `src/components/ui/tabs.tsx` | Radix Tabs primitive | No change needed — already exists |
| `src/components/ui/card.tsx` | Card primitive | No change needed |
| `src/lib/utils.ts` | Utility functions | No change needed — formatCurrency, formatDate, formatHours all exist |

### Relevant Type Shapes

- **DailyLogRow**: `{ id, user_id, job_id, date, hours_worked, hours_billed, total_value, meetings, requests, daily_rate }`
- **AgendaEventRow**: `{ id, user_id, job_id, title, description, type, event_date, is_done, task_status, priority, budget }`
- **InvoiceRow**: `{ id, user_id, job_id, invoice_number, total, currency, status, due_date, period_start, period_end }`
- **JobRow**: `{ id, user_id, client_id, name, hourly_rate, daily_rate, currency, status }`
- **UserGoalRow**: `{ id, user_id, type ('hours_month'|'revenue_month'), target, period }`

### Queries Needed for Daily View

1. **Today's logs**: `daily_logs` where `date = today`, select `hours_worked, hours_billed, total_value, jobs(name, clients(name))`
2. **Today's agenda events**: `agenda_events` where `event_date = today`, include all task_status values (not just `is_done = false`)
3. **Overdue invoices**: `invoices` where `status = 'overdue'`, select with `jobs(name, clients(name))`
4. **Stale active jobs** (for R007): `jobs` where `status = 'active'`, then for each job check if there's a daily_log in the last 7-14 days. Two approaches:
   - **Option A (recommended)**: Fetch all active jobs + fetch all daily_logs from last 14 days grouped by job_id, then compute staleness client-side
   - **Option B**: Use a Supabase RPC/view — overkill for MVP
5. **Monthly goals**: Already fetched in current page (reuse for both views)
6. **Monthly logs**: Already fetched (reuse for goal progress calculation in daily view)

### Build Order

1. **T01: Refactor server component + create client shell** — Extract current rendering into `monthly-view.tsx`, create `dashboard-client.tsx` with Tabs, modify `page.tsx` to fetch daily + monthly data and pass to client. Verify monthly view still works identically.
2. **T02: Build daily KPI + agenda widgets** — Create `daily-view.tsx` with hours-today card, today's agenda tasks list, overdue invoices card. Wire into "Hoje" tab.
3. **T03: Build revenue-at-risk widget (R007)** — Create `revenue-at-risk.tsx` showing overdue invoice total + stale jobs (active jobs with no log in last 14 days) and their estimated monthly value. Add to daily view.
4. **T04: Polish daily goal progress + final integration** — Show monthly goal progress in daily view with today's contribution highlighted. Ensure toggle defaults to "Hoje", URL doesn't change between tabs. Final visual polish.

### Verification Approach

- **T01**: Monthly view renders identically to current production (visual diff). No regressions in KPI numbers, charts, or invoice/event lists.
- **T02**: Daily view shows correct hours for today (cross-check with /logs page filtered to today). Agenda shows today's events (cross-check with /agenda). Overdue invoices match /invoices page filtered to overdue status.
- **T03**: Revenue-at-risk widget shows sum of overdue invoice totals. Stale jobs list matches active jobs with no daily_log in last 14 days (verifiable by checking /logs).
- **T04**: Tab defaults to "Hoje" on page load. Switching tabs is instant (no reload). Goal progress numbers match /metas page.

## Common Pitfalls

1. **Server vs Client boundary**: The current `page.tsx` is a pure server component. Adding Tabs requires client state. The refactor MUST keep data fetching in the server component and pass serializable props to the client. Do NOT convert `page.tsx` to "use client" — that would break all server-side Supabase queries.

2. **Type casting**: The current codebase uses `as unknown as { name: string }` casts for Supabase join results (see lines 272, 302 in current page.tsx). Continue this pattern for consistency until Supabase improves join typing.

3. **Date handling for "today"**: Use `format(now, "yyyy-MM-dd")` consistently (already the pattern in the codebase). Be aware that the server's timezone may differ from the user's — this is an existing limitation, not something to solve in this slice.

4. **Empty states**: All daily view widgets must handle the case where there are no logs today, no events today, no overdue invoices, and no stale jobs. The existing codebase consistently shows "Nenhum..." messages for empty states.

5. **Overdue invoices query**: The `status` field on invoices is only updated to 'overdue' by the billing-reminders cron job. Some invoices may be past `due_date` but still have `status = 'sent'`. The daily view should consider both `status = 'overdue'` AND `status = 'sent' AND due_date < today` for a complete picture. This is consistent with how the cron at `src/app/api/cron/billing-reminders/route.ts` (line 52) queries `.in("status", ["sent", "overdue"])`.

6. **Revenue-at-risk calculation**: For stale jobs, the "at risk" value should be calculated as `hourly_rate * average_daily_hours * days_since_last_log` or simply flag the job with its `hourly_rate` and `daily_rate`. Keep it simple for MVP — showing the job name, client, hourly rate, and days since last log is more actionable than a speculative dollar amount.

## Constraints

- **No new dependencies needed**: All required packages are already installed (recharts, date-fns, radix-ui/react-tabs, lucide-react).
- **No database migrations**: All required tables and columns already exist. The daily view is purely a presentation-layer change.
- **S01 dependency satisfied**: Complete TypeScript types for all 28 tables are available in `src/lib/supabase/types.ts`.
- **Existing UI language**: The app UI is in Portuguese (BR). All new labels and messages must follow this convention. Code/types/commits remain in English.
- **Performance**: The current page already makes 8 parallel queries. Adding 2-3 more for the daily view (today's logs, overdue invoices, recent logs per job) is acceptable since they're all parallelized via `Promise.all`. The daily queries will be lightweight (single-day filters return few rows).
