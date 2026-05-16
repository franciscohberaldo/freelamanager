---
estimated_steps: 11
estimated_files: 2
skills_used: []
---

# T03: Build revenue-at-risk widget (R007)

**Why:** R007 differentiator — freelancer loses money by not tracking overdue invoices and abandoned jobs. This widget surfaces 'money that might slip away' by combining overdue invoice totals with active jobs that have no recent daily_log.

**Do:**
1. Create `revenue-at-risk.tsx` with 'use client' — receives overdue invoices, active jobs, and recent logs (last 14 days) as props.
2. Compute stale jobs: for each active job, check if there's a daily_log entry in the last 14 days. Jobs with no recent log are 'stale'.
3. Render two sections:
   - 'Invoices vencidos' total: sum of overdue invoice totals, grouped by currency using formatCurrency.
   - 'Jobs sem atividade recente': list stale jobs with job name, client name (via FK join), hourly_rate or daily_rate, and days since last log.
4. Show combined 'receita em risco' header with AlertTriangle icon.
5. Handle empty state: if no overdue invoices and no stale jobs, show a positive message like 'Tudo em dia!' with a CheckCircle icon.
6. Add the revenue-at-risk widget to daily-view.tsx between the overdue invoices card and goal progress.

**Done when:** Revenue-at-risk widget shows in daily view. Stale jobs correctly computed from 14-day window. Empty state works. npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/dashboard/daily-view.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/lib/supabase/types.ts`
- `src/lib/utils.ts`

## Expected Output

- `src/app/(app)/dashboard/revenue-at-risk.tsx`
- `src/app/(app)/dashboard/daily-view.tsx`

## Verification

npx tsc --noEmit
