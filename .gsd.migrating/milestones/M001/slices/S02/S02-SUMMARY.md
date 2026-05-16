---
id: S02
parent: M001
milestone: M001
provides:
  - Consolidated sidebar with exactly 9 nav items (S04 depends on this for badge placement)
  - Agenda page as single surface for scheduling + availability + time-off
  - Clients page with embedded Pipeline tab
requires:
  - slice: S01
    provides: Complete types in src/lib/supabase/types.ts covering all tables
affects:
  - S04
key_files:
  - src/components/layout/sidebar.tsx
  - src/components/command-palette.tsx
  - src/app/(app)/agenda/agenda-client.tsx
  - src/app/(app)/clients/clients-page-client.tsx
  - src/app/(app)/folgas/folgas-client.tsx
key_decisions:
  - Used ComponentProps<typeof X> to derive prop types from AvailabilityClient and FolgasClient — prevents type drift
  - Kept page header outside Tabs in ClientsPageClient so it stays visible on both tabs
  - Adapted availability sync from per-date upserts to singleton status update — schema has no date column
  - Only sync availability when affected date is today — changing general status for future folga would be incorrect
patterns_established:
  - Tab consolidation pattern: parent page renders shared header + Tabs; child components are imported and rendered inside TabsContent
  - Availability sync pattern: mutation paths call syncAvailabilityForDate after successful Supabase write
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001/slices/S02/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001/slices/S02/tasks/T05-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-05-16T12:56:33.489Z
blocker_discovered: false
---

# S02: Consolidar Navegacao

**Sidebar consolidada de 16 para 9 itens; Agenda ganhou abas Disponibilidade/Folgas; Clientes ganhou aba Pipeline; journaling removido; folga criada marca dia como indisponível**

## What Happened

This slice consolidated the app's navigation from 16 sidebar items down to exactly 9 by merging related views into tabs within their parent pages and removing dead features.

**T01** removed the journaling/mood feature entirely — deleted `journal-client.tsx`, purged `DailyJournal` types from Supabase types, removed `diary_entries` from the export API, and cleaned all sidebar/command-palette references. The `/diario` route now serves only work tracking (TrackingClient).

**T02** consolidated the Agenda page by adding Disponibilidade and Folgas as two new tabs alongside the existing 4 views (Tabela, Timeline, Gantt, Calendário), bringing the total to 6 tabs. Used `ComponentProps<typeof X>` to derive prop types rather than duplicating interfaces.

**T03** consolidated the Clients page by wrapping the existing client list and a new Pipeline tab inside a Tabs layout. Created `ClientsPageClient` with the page header (title, CSV export, Novo Cliente button) outside tabs so it remains visible regardless of active tab. Also fixed a pre-existing `FolderKanban` import error in command-palette.tsx.

**T04** reduced the sidebar `navItems` array to exactly 9 entries and aligned the command palette's `STATIC_LINKS` to match. Removed standalone entries for Disponibilidade, Folgas, Pipeline, and Projetos. Added the missing Despesas entry to the command palette.

**T05** implemented automatic availability sync when folgas are created or deleted. The `syncAvailabilityForDate` function upserts the `user_availability` status to 'indisponivel' when a folga covers today, and reverts to 'disponivel' when deleted. Adapted from the plan's per-date model to match the actual schema (singleton status row, no date column).

## Verification

All slice-level verification checks passed:

1. `npx tsc --noEmit` — exits 0, zero type errors
2. `grep -rn "journal-client|DailyJournal|diary_entries|daily_journal" src/` — zero matches, all journaling references removed
3. Sidebar `navItems` array contains exactly 9 entries: Dashboard, Tracking Diário, Jobs, Clientes, Invoices, Despesas, Agenda, Relatórios, Configurações
4. Agenda renders 6 TabsContent: table, timeline, gantt, calendar, disponibilidade, folgas
5. Clients renders TabsTrigger for "clientes" and "pipeline" tabs
6. Folgas calls `syncAvailabilityForDate` in all 3 mutation paths (create, toggle existing, delete)

## Requirements Advanced

- R004 — All journaling/mood code and references removed — zero grep hits for journal-client, DailyJournal, diary_entries, daily_journal in src/
- R005 — Sidebar consolidated from 16 to exactly 9 items via tab grouping (Agenda+Disponibilidade+Folgas, Clients+Pipeline) and dead feature removal
- R008 — syncAvailabilityForDate upserts user_availability status to indisponivel when folga covers today, reverts on delete

## Requirements Validated

- R004 — grep -rn for all journaling identifiers returns zero matches in src/
- R005 — Node script counts exactly 9 href entries in navItems array: Dashboard, Tracking Diário, Jobs, Clientes, Invoices, Despesas, Agenda, Relatórios, Configurações
- R008 — grep shows syncAvailabilityForDate called in 3 mutation paths in folgas-client.tsx (create, toggle, delete); function upserts user_availability table

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Operational Readiness

None.

## Deviations

T05 adapted from per-date user_availability upserts (plan specified onConflict: 'user_id,date') to singleton status row update — the actual schema has no date column, only a general status per user. Sync is scoped to today-only changes.

## Known Limitations

Availability sync only fires client-side and only affects today's date. If a user creates a folga for tomorrow and then tomorrow arrives, the status won't auto-update — that would require a server-side cron or database trigger (out of scope for this client-side slice). Standalone routes /disponibilidade and /folgas still exist for backward compatibility but are no longer in the sidebar.

## Follow-ups

Consider adding a server-side trigger or daily cron to sync user_availability for folgas that become active overnight. Consider removing standalone /disponibilidade and /folgas routes once analytics confirm no direct traffic.

## Files Created/Modified

- `src/app/(app)/diario/journal-client.tsx` — Deleted — journaling feature removed
- `src/components/layout/sidebar.tsx` — Reduced navItems from 16 to 9 entries, removed journal/disponibilidade/folgas/pipeline/projetos entries
- `src/components/command-palette.tsx` — Aligned STATIC_LINKS to 9-item nav, removed Supabase projects query, added Despesas, fixed FolderKanban import
- `src/app/api/export/route.ts` — Removed diary_entries export block
- `src/lib/supabase/types.ts` — Removed DailyJournal interface and daily_journal table type
- `src/app/(app)/agenda/page.tsx` — Added server-side data fetching for availability and folgas
- `src/app/(app)/agenda/agenda-client.tsx` — Added Disponibilidade and Folgas as tabs 5 and 6
- `src/app/(app)/clients/page.tsx` — Added pipeline data fetching, renders ClientsPageClient
- `src/app/(app)/clients/clients-page-client.tsx` — New file — wraps Clientes and Pipeline in Tabs layout
- `src/app/(app)/folgas/folgas-client.tsx` — Added syncAvailabilityForDate function, calls it on create/toggle/delete mutations
