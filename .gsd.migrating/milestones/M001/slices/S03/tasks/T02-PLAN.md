---
estimated_steps: 10
estimated_files: 2
skills_used: []
---

# T02: Build daily view with KPI cards, agenda, and overdue invoices

**Why:** The daily view (R006) is the primary user loop — freelancer opens the app and needs to see hours today, today's tasks, and overdue invoices in 5 seconds.

**Do:**
1. Create `daily-view.tsx` with 'use client' — receives today's logs, today's events, overdue invoices, goals, month logs, and revenue-at-risk data as props.
2. Build 'Horas hoje' KPI card — sum hours_worked from today's logs, show job breakdown below.
3. Build 'Tarefas de hoje' section — list today's agenda_events with task_status indicators (pending/in_progress/done), priority badges, and links to /agenda.
4. Build 'Invoices vencidas' card — list overdue invoices with invoice number, client/job name, total formatted with formatCurrency(total, currency), and due_date. Show count badge.
5. Build monthly goal progress bars (reuse same visual pattern from current page.tsx goals section) — show revenue_month and hours_month progress with today's contribution highlighted via a different-colored segment or annotation.
6. Handle empty states: 'Nenhum registro hoje', 'Nenhuma tarefa hoje', 'Nenhum invoice vencido' messages.
7. Wire daily-view into dashboard-client.tsx's 'hoje' tab (replace placeholder).

**Done when:** Daily tab shows hours today (or empty state), today's agenda tasks (or empty state), overdue invoices (or empty state), and goal progress. npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/monthly-view.tsx`
- `src/lib/supabase/types.ts`
- `src/lib/utils.ts`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`

## Expected Output

- `src/app/(app)/dashboard/daily-view.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`

## Verification

npx tsc --noEmit
