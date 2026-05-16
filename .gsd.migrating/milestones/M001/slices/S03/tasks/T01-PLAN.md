---
estimated_steps: 8
estimated_files: 3
skills_used: []
---

# T01: Refactor page.tsx into server+client shell with Tabs

**Why:** The current page.tsx is a ~312-line server component rendering monthly data. Adding a daily/monthly toggle requires client state (Tabs), which can't live in a server component. We need to split data fetching (server) from rendering (client) and extract the monthly view into its own file.

**Do:**
1. Create `dashboard-client.tsx` with 'use client' — accepts all fetched data as props, renders Tabs (Hoje/Mensal) defaulting to 'hoje'. For now the daily tab shows a placeholder.
2. Create `monthly-view.tsx` — extract ALL current rendering from page.tsx (KPI cards, goals, charts, invoices list, events list) into this component. It receives the same data as props. Must render identically to current production.
3. Modify `page.tsx` to: (a) keep all existing 8 queries, (b) add 3 new parallel queries for daily view — today's logs with job+client joins, today's agenda_events (all statuses, not just is_done=false), overdue invoices (status IN ['overdue'] OR status='sent' AND due_date < today) with job+client joins, (c) add query for active jobs for revenue-at-risk, (d) add query for daily_logs from last 14 days (for staleness check), (e) pass all data to DashboardClient.
4. Use `as unknown as T` pattern for FK join casts (consistent with S01 decisions).
5. Use `format(now, 'yyyy-MM-dd')` for today's date filter.

**Done when:** Monthly tab renders identically to current production. Daily tab shows placeholder. npx tsc --noEmit exits 0. No 'as any' introduced.

## Inputs

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-charts.tsx`
- `src/app/(app)/dashboard/forecast-chart.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/card.tsx`
- `src/lib/supabase/types.ts`
- `src/lib/utils.ts`

## Expected Output

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/monthly-view.tsx`

## Verification

npx tsc --noEmit
