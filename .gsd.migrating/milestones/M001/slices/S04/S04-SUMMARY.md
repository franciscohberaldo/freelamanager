---
id: S04
parent: M001
milestone: M001
provides:
  - Timer auto-stop with configurable max hours via localStorage
  - Sidebar notification badges for overdue invoices and stalled deals
  - TimerSettings component in Settings page
requires:
  - slice: S02
    provides: Sidebar consolidada com 9 itens (where badges render)
affects:
  - S05
  - S06
key_files:
  - src/app/(app)/logs/log-timer-button.tsx
  - src/app/(app)/settings/timer-settings.tsx
  - src/app/(app)/settings/page.tsx
  - src/components/layout/sidebar.tsx
key_decisions:
  - Auto-stop resets state without saving to DB (forgotten timer = inaccurate data)
  - Stalled deals threshold set to 7 days without update
  - Used head:true count queries for badge efficiency — no row data transferred
  - Badge placed right-aligned within nav item using flex-1 on label span
patterns_established:
  - localStorage for user preferences with sensible defaults
  - Supabase head:true count queries for lightweight badge data
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S04/tasks/T03-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-16T19:29:48.250Z
blocker_discovered: false
---

# S04: Timer & Notificacoes

**Timer auto-stops at configurable max hours (default 8h) with warning toast, and sidebar shows red notification badges for overdue invoices and stalled deals**

## What Happened

Three tasks delivered the slice goal of operational awareness for the freelancer:\n\n**T01 — Timer auto-stop:** Modified `log-timer-button.tsx` to read a `timer_max_hours` value from localStorage (default 8h). The timer's setInterval tick checks elapsed time against this limit and, on breach, fires a warning toast, clears the interval, and resets active state. Intentionally does NOT persist hours to DB on auto-stop since hitting max implies forgotten timer with potentially inaccurate accumulated time.\n\n**T02 — Timer settings card:** Created `timer-settings.tsx` with an input for max hours that persists to localStorage under key `timer_max_hours`. Imported into the settings page after the password card, following the existing card layout pattern.\n\n**T03 — Sidebar notification badges:** Added Supabase count queries (head:true for efficiency) that fetch overdue invoice count and stalled deal count (deals not updated in 7+ days). Red `Badge` components render next to Invoices and Clientes nav items when counts > 0. Uses `useState` + `useEffect` in the existing client-side sidebar component.

## Verification

All three tasks verified individually with `npx tsc --noEmit` passing with zero errors. Slice-level verification re-ran TypeScript check confirming clean compilation across all modified files (log-timer-button.tsx, timer-settings.tsx, settings/page.tsx, sidebar.tsx).

## Requirements Advanced

- R009 — Timer auto-stops at configured max hours with toast notification
- R010 — Red badges on sidebar show overdue invoice and stalled deal counts

## Requirements Validated

- R009 — npx tsc --noEmit passes; timer reads max_hours from localStorage and auto-stops with toast
- R010 — npx tsc --noEmit passes; sidebar renders Badge components with Supabase count query results

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

Auto-stop does not call handleStop() as originally assumed — it resets state without persisting to DB, since hitting max hours implies the user forgot the timer and accumulated time is unreliable.

## Known Limitations

Badge counts only refresh on sidebar mount (no real-time subscription or polling interval). Auto-stop does not persist hours — user must manually stop to save valid time.

## Follow-ups

none

## Files Created/Modified

- `src/app/(app)/logs/log-timer-button.tsx` — Added auto-stop logic reading timer_max_hours from localStorage with 8h default
- `src/app/(app)/settings/timer-settings.tsx` — Created TimerSettings card component with max-hours input persisted to localStorage
- `src/app/(app)/settings/page.tsx` — Imported and rendered TimerSettings component
- `src/components/layout/sidebar.tsx` — Added Badge import, Supabase count queries for overdue invoices and stalled deals, conditional badge rendering
