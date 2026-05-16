---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T03: Add notification badges to sidebar nav items

Why: Without visual cues, freelancer misses overdue invoices and stalled deals (R010). The sidebar is a 'use client' component that persists across navigations — ideal place for count badges.

Do:
1. In sidebar.tsx, add a useEffect that queries Supabase on mount for: (a) count of invoices with status='overdue', (b) count of sales_pipeline entries where stage not in ('won','lost') and updated_at < 7 days ago.
2. Store counts in useState: overdueInvoices, stalledDeals.
3. Extend the navItems.map() render to conditionally show a small Badge (variant='destructive', className for small pill sizing) next to the label for '/invoices' (overdueInvoices count) and '/clients' (stalledDeals count). Only render badge when count > 0.
4. Import Badge from src/components/ui/badge.tsx.
5. Use .count() Supabase method for efficient count-only queries.

Done when: Sidebar shows red count badges next to Invoices and Clientes when there are overdue invoices or stalled deals respectively. Badges hide when counts are 0.

## Inputs

- `src/components/layout/sidebar.tsx`
- `src/components/ui/badge.tsx`

## Expected Output

- `src/components/layout/sidebar.tsx`

## Verification

npx tsc --noEmit
