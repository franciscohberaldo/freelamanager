# S04: Timer & Notificacoes — Research

**Date:** 2026-05-16
**Depth:** Light research — established patterns, local codebase, straightforward feature work.

## Summary

S04 adds two independent features: (1) an auto-stop mechanism on the existing timer that fires a toast after a configurable max duration (default 8h), and (2) a notification badge on specific sidebar items showing counts of overdue invoices and stalled deals.

Both features are well-scoped. The timer already exists in `log-timer-button.tsx` as a simple `useState`/`setInterval` counter — it just needs a max-seconds guard in the `useEffect` tick plus a toast call. The sidebar is a flat `navItems.map()` loop in `sidebar.tsx` — adding a count badge means querying Supabase for overdue invoices and stalled deals, then rendering a small counter dot next to the relevant nav items.

The timer max-hours setting should be stored in `user_settings` (requires adding a `timer_max_hours` column or using a JSON preferences column). However, to avoid a DB migration dependency, the simplest approach is to store the preference client-side in `localStorage` with a default of 8, and add a UI control in the Settings page. This is a single-user app with no cross-device sync requirement.

## Recommendation

**Timer auto-stop:** Add a `MAX_SECONDS` constant derived from localStorage (default 8h = 28800s). In the existing `useEffect` tick inside `LogTimerButton`, check if `seconds >= maxSeconds` and if so, call `handleStop()` automatically and fire `toast.warning("Timer parou automaticamente após Xh")`. Add a small config input in the Settings page under a new "Timer" card.

**Notification badges:** Make the `Sidebar` component fetch overdue invoice count and stalled deal count via Supabase on mount (client-side queries since Sidebar is `"use client"`). Render a small red dot/count next to the Invoices nav item (overdue count) and Clientes nav item (stalled deals count). Use the existing `Badge` component from `src/components/ui/badge.tsx` with `variant="destructive"` sized down to a small pill.

Build timer first (self-contained, no cross-component deps), then badge (touches sidebar + queries).

## Implementation Landscape

### Key Files

- `src/app/(app)/logs/log-timer-button.tsx` — Timer component. Currently a pure client counter with play/pause/stop. Needs max-seconds guard in the `useEffect` tick callback and auto-stop with toast. ~15 lines of change.
- `src/components/layout/sidebar.tsx` — `"use client"` component with `navItems` array and `navItems.map()` render. Needs Supabase queries for overdue invoice count + stalled deal count, and a badge rendered conditionally next to the icon/label.
- `src/app/(app)/settings/page.tsx` — Server component that renders settings cards. Needs a new "Timer" card with a number input for max hours.
- `src/components/ui/badge.tsx` — Existing shadcn Badge with `destructive` variant. Ready to use as-is for sidebar count pills.
- `src/lib/supabase/types.ts` — `UserSettingsRow` currently has no `timer_max_hours` field. If using localStorage approach, no type change needed. If using DB column, needs adding.

### Natural Seams

1. **Timer auto-stop** — fully contained in `log-timer-button.tsx` + settings page. No other component depends on timer state.
2. **Sidebar badges** — contained in `sidebar.tsx` with two independent Supabase queries. Could be a single task or split into overdue-invoices badge + stalled-deals badge.
3. **Timer config UI** — settings page card, independent of badge work.

### Build Order

1. **Timer auto-stop** (highest value, zero deps) — modify `log-timer-button.tsx` to check max seconds on each tick. Use `localStorage` for the configurable limit with 8h default. This is the core R009 deliverable.
2. **Timer config in Settings** — add a "Timer" card to settings page with a number input for max hours, persisted to localStorage.
3. **Sidebar notification badges** — add Supabase queries in `sidebar.tsx` for overdue invoices (status = 'overdue') and stalled deals (open deals with `updated_at` > 7 days ago). Render count badges. This is the R010 deliverable.

### Verification Approach

- **Timer auto-stop:** Start timer, set max to a low value (e.g. 5 seconds via localStorage override), confirm it auto-stops and shows toast. Then verify normal operation with default 8h.
- **TypeScript:** `npx tsc --noEmit` exits 0.
- **Sidebar badges:** Create a test overdue invoice in Supabase, confirm badge appears next to Invoices. Check stalled deals badge next to Clientes.
- **Settings:** Open /settings, find Timer card, change value, reload — confirm localStorage persistence.

## Constraints

- `user_settings` DB table has no `timer_max_hours` column — avoid DB migration by using `localStorage` (single-user app, no cross-device need).
- Sidebar is `"use client"` — can use `createClient()` for Supabase queries but they run client-side (acceptable for count queries).
- `sales_pipeline` has `updated_at` column — can detect stalled deals as open deals (not won/lost) where `updated_at` is older than 7 days.
- Overdue invoices already have `status = 'overdue'` — simple count query.
- Timer state is per-component instance (each `LogTimerButton` has its own `seconds` state) — only one timer runs at a time in practice since user works on one log.

## Common Pitfalls

- **Timer auto-stop calling handleStop in useEffect** — `handleStop` is async and accesses `seconds` state. The auto-stop should use a ref for the accumulated seconds to avoid stale closure. Or: check max in the `setSeconds` updater callback and set a flag ref that triggers stop outside the interval.
- **Sidebar queries on every render** — must use `useEffect` with empty deps or a state hook, not inline queries. Consider `useState` + `useEffect` with a reasonable poll interval (or just on mount) to avoid hammering Supabase.
- **Badge flicker on navigation** — sidebar re-mounts on route changes in Next.js App Router only if the layout re-renders. Since `Sidebar` is in `(app)/layout.tsx`, it persists across navigations — queries run once on mount, which is correct.

## Open Risks

- If multiple `LogTimerButton` instances are active simultaneously (theoretically possible if user opens multiple log rows), only one auto-stop fires per component. This is fine — each component manages its own timer independently.
- localStorage is per-browser. If user switches browsers, timer config resets to default 8h. Acceptable for single-user app.