# S03: Dashboard do Dia — UAT

**Milestone:** M001
**Written:** 2026-05-16T13:12:41.598Z

# S03: Dashboard do Dia — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: mixed (artifact-driven build verification + live-runtime smoke test)
- Why this mode is sufficient: Dashboard is a read-only view with no mutations — build success + dev server rendering confirms data flow from Supabase queries through server/client boundary to UI components

## Preconditions

- Supabase instance running with seeded data (clients, jobs, invoices, daily_logs, agenda_tasks, goals)
- `npm run dev` starts successfully on port 3000
- User is authenticated (logged in)

## Smoke Test

Navigate to http://localhost:3000/dashboard — page loads with "Hoje" tab active showing KPI cards, agenda, and goal progress. Click "Mensal" tab — monthly view renders with charts and forecast.

## Test Cases

### 1. Daily KPI Cards Display

1. Navigate to /dashboard
2. Observe the "Hoje" tab is active by default
3. **Expected:** Three KPI cards visible: "Horas Hoje" (hours logged today), "Tarefas" (today's task count), "Invoices Vencidas" (overdue invoice count with destructive badge if > 0)

### 2. Agenda Section Shows Today's Tasks

1. On the daily view, scroll to the agenda section
2. **Expected:** Tasks scheduled for today are listed with their titles and status indicators

### 3. Overdue Invoices List

1. On the daily view, scroll to the overdue invoices section
2. **Expected:** Each overdue invoice shows client name, amount formatted in the invoice's own currency (e.g., USD shows $, BRL shows R$), and days overdue

### 4. Revenue-at-Risk Widget

1. On the daily view, locate the revenue-at-risk widget
2. **Expected:** Shows two sections: (a) overdue invoice totals grouped by currency, (b) stale active jobs with no daily_log in 14+ days showing job name, client, and rate

### 5. Goal Progress Bars

1. On the daily view, scroll to goal progress section
2. **Expected:** Each active goal shows a progress bar with two-tone segments — lighter for prior month progress, darker for today's contribution

### 6. Tab Switching to Monthly View

1. Click the "Mensal" tab
2. **Expected:** Monthly dashboard renders identically to pre-refactor: KPIs, charts, forecast, invoices, events. No page reload occurs.

### 7. Tab Switching Back to Daily View

1. From the "Mensal" tab, click "Hoje"
2. **Expected:** Daily view re-renders instantly with same data. No page reload.

## Edge Cases

### No Data for Today

1. Navigate to /dashboard when no daily_logs, tasks, or overdue invoices exist for today
2. **Expected:** KPI cards show 0 values. Agenda shows empty state. Revenue-at-risk shows positive message ("Nenhum risco identificado" or similar). Goal progress shows month-to-date only.

### Multiple Currencies in Overdue Invoices

1. Have overdue invoices in both USD and BRL
2. **Expected:** Revenue-at-risk widget groups totals by currency, showing separate formatted amounts (e.g., "$1,500.00" and "R$ 3.200,00")

### No Active Goals

1. Navigate to /dashboard with no goals configured
2. **Expected:** Goal progress section shows empty state or is hidden gracefully

## Failure Signals

- Dashboard shows blank/white screen (server query failure)
- KPI cards show "NaN" or "undefined" (type mismatch in data flow)
- Currency shows wrong format (e.g., BRL amount on USD invoice)
- Tab switching causes full page reload (client/server boundary broken)
- TypeScript errors in build output
- "as any" present in dashboard files

## Not Proven By This UAT

- Timer auto-stop at 8h (S04)
- Notification badges on sidebar (S04)
- Command palette search (S05)
- Client portal functionality (S06)
- Performance under large datasets (100+ invoices, 1000+ daily_logs)
- Mobile/responsive layout behavior

## Notes for Tester

- The 14-day stale job threshold is hardcoded — cannot be changed in settings yet
- Goal progress bars show month-to-date, not weekly or quarterly
- Revenue-at-risk widget always renders even with no risk (shows positive empty state by design)
