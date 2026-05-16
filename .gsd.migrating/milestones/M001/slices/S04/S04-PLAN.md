# S04: Timer & Notificacoes

**Goal:** Timer para automaticamente em 8h (configurável) com toast de aviso. Badge na sidebar mostra contagem de invoices vencidas e deals parados.
**Demo:** Timer para automaticamente em 8h com toast. Badge na sidebar mostra contagem de invoices vencidas e deals parados.

## Must-Haves

- 1. Timer auto-stops after configured max hours (default 8h) and shows warning toast\n2. Settings page has Timer card with max-hours input persisted to localStorage\n3. Sidebar shows red badge next to Invoices with overdue count\n4. Sidebar shows red badge next to Clientes with stalled deals count\n5. npx tsc --noEmit exits 0

## Proof Level

- This slice proves: operational

## Integration Closure

Upstream surfaces consumed: sidebar.tsx (9-item navItems from S02), log-timer-button.tsx (existing timer), settings/page.tsx (existing cards layout). New wiring: localStorage key 'timer_max_hours' read by timer component and written by settings form; Supabase count queries in sidebar for overdue invoices and stalled deals. What remains: S05 (command palette), S06 (client portal).

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [ ] **T01: Add timer auto-stop with configurable max hours** `est:45m`
  Why: Freelancer forgets timer running overnight, corrupting hours data (R009). The timer ticks via setInterval in log-timer-button.tsx but has no upper bound.
  - Files: `src/app/(app)/logs/log-timer-button.tsx`
  - Verify: npx tsc --noEmit

- [ ] **T02: Add Timer settings card to Settings page** `est:30m`
  Why: User needs a way to configure the max timer hours (R009 configurability). Settings page already has multiple cards; adding one more follows the established pattern.
  - Files: `src/app/(app)/settings/timer-settings.tsx`, `src/app/(app)/settings/page.tsx`
  - Verify: npx tsc --noEmit

- [ ] **T03: Add notification badges to sidebar nav items** `est:45m`
  Why: Without visual cues, freelancer misses overdue invoices and stalled deals (R010). The sidebar is a 'use client' component that persists across navigations — ideal place for count badges.
  - Files: `src/components/layout/sidebar.tsx`
  - Verify: npx tsc --noEmit

## Files Likely Touched

- src/app/(app)/logs/log-timer-button.tsx
- src/app/(app)/settings/timer-settings.tsx
- src/app/(app)/settings/page.tsx
- src/components/layout/sidebar.tsx
