---
id: T03
parent: S04
milestone: M001
key_files:
  - src/components/layout/sidebar.tsx
key_decisions:
  - Used head:true count queries for efficiency — no row data transferred
  - Stalled deals threshold set to 7 days without update, matching the task plan specification
  - Badge placed right-aligned within nav item using flex-1 on label span
duration: 
verification_result: passed
completed_at: 2026-05-16T19:26:47.914Z
blocker_discovered: false
---

# T03: Added red notification badges to sidebar nav showing overdue invoice count and stalled deal count

**Added red notification badges to sidebar nav showing overdue invoice count and stalled deal count**

## What Happened

Added notification badges to the sidebar navigation component. On mount, the sidebar fetches two counts from Supabase using efficient head-only queries: (1) invoices with status='overdue', and (2) sales_pipeline entries not in won/lost stages that haven't been updated in 7+ days. These counts render as small red destructive badges next to the Invoices and Clientes nav items respectively, only appearing when count > 0. The nav item layout was adjusted to use flex-1 on the label span so badges align to the right edge.

## Verification

Ran `npx tsc --noEmit` — passed with zero errors. Verified Badge import resolves correctly and all Supabase query types are compatible.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/layout/sidebar.tsx`
