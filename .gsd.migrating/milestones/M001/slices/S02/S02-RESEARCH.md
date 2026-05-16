# S02 Research — Consolidar Navegacao

## Summary

The current sidebar at `src/components/layout/sidebar.tsx` contains exactly **16 navigation items** (lines 17-34): Dashboard, Tracking Diario, Diario, Jobs, Clientes, Pipeline, Invoices, Despesas, Metas, Projetos, Acomp. de Jobs (agenda), Status de Agenda (disponibilidade), Folgas/Ferias, Relatorios, Automacoes, and Configuracoes. The target is to consolidate these 16 items down to 9 by removing the journaling feature entirely (R004), merging related screens into tab-based pages (R005), and wiring folgas to block disponibilidade (R008).

The journaling/mood feature (R004) lives in `src/app/(app)/diario/journal-client.tsx` — a 313-line client component that reads/writes the `daily_journal` Supabase table with mood tracking and calendar UI. Critically, **this component is already dead code**: `JournalClient` is not imported by any file in the project. The `/diario` route's `page.tsx` only renders `TrackingClient` (work-hour tracking from `daily_logs`). However, references to the journaling concept still exist in: (a) the sidebar item `{ href: "/diario", label: "Diario", icon: BookText }`, (b) the command palette's `STATIC_LINKS` array which includes a "Diario" entry pointing to `/diario`, (c) the export API at `src/app/api/export/route.ts` which fetches `diary_entries` (note: different table name from `daily_journal` — likely a bug or legacy reference), and (d) the type definitions in `src/lib/supabase/types.ts` (`DailyJournalRow`, `DailyJournalInsert`, `daily_journal` table entry). The `/diario` route currently serves as the work-tracking calendar — its `TrackingClient` component should be preserved but relocated or renamed.

For tab consolidation (R005), the project already has the shadcn/ui `Tabs` component installed at `src/components/ui/tabs.tsx` (Radix-based), and the Agenda page (`src/app/(app)/agenda/agenda-client.tsx`) already demonstrates the exact tab pattern needed — it uses `Tabs/TabsList/TabsTrigger/TabsContent` with 4 tabs (Tabela, Timeline, Gantt, Calendario). This is the proven pattern to replicate. The Pipeline page (`src/app/(app)/pipeline/`) is a standalone Kanban board that needs to become a tab inside the Clients page. The Disponibilidade page (`src/app/(app)/disponibilidade/`) is a settings-style form for weekly availability status, and the Folgas page (`src/app/(app)/folgas/`) is a calendar for marking days off — both need to become tabs inside the Agenda page. For R008, when a folga is created in `folgas-client.tsx` (via `supabase.from("time_off").insert(...)`), the system must also update `user_availability` to mark that day as unavailable; currently these two systems are completely independent with zero cross-references.

## Recommendation

Execute in 5 tasks with clear boundaries:

1. **Remove journaling feature** (R004) — delete `journal-client.tsx`, remove "Diario" from sidebar and command palette, remove `diary_entries` from export API, remove `daily_journal` type definitions. Keep `TrackingClient` and the `/diario` route but rename the sidebar label.
2. **Consolidate Agenda page with Disponibilidade + Folgas tabs** (R005 partial) — add "Disponibilidade" and "Folgas" as new tabs to the existing Agenda page, importing the existing client components.
3. **Consolidate Clients page with Pipeline tab** (R005 partial) — add "Pipeline" tab to the Clients page, importing the existing `PipelineClient`.
4. **Update sidebar to 9 items** (R005 final) — remove the now-merged standalone routes from sidebar, rename entries, clean up command palette.
5. **Folgas blocks disponibilidade** (R008) — after a folga is saved, auto-update `user_availability` status for that date range.

## Implementation Landscape

### Key Files

| File | Role | Change needed |
|------|------|--------------|
| `src/components/layout/sidebar.tsx` | Sidebar nav (16 items) | Reduce to 9 items, remove /diario, /pipeline, /disponibilidade, /folgas, /automacoes, /metas, /logs entries; rename remaining |
| `src/app/(app)/diario/journal-client.tsx` | Dead journaling component | **Delete entirely** |
| `src/app/(app)/diario/page.tsx` | Work tracking server page | May rename route or keep as-is with sidebar label change |
| `src/app/(app)/diario/tracking-client.tsx` | Work tracking calendar (689 lines) | No changes to logic; just needs to be reachable from new sidebar label |
| `src/components/command-palette.tsx` | Global search (Cmd+K) | Remove "Diario" entry from `STATIC_LINKS`, update entries to match new sidebar |
| `src/app/api/export/route.ts` | JSON backup export | Remove `diary_entries` / `diaryEntries` fetch (line 33, 51) |
| `src/lib/supabase/types.ts` | TypeScript types for all 28 tables | Remove `DailyJournalRow`, `DailyJournalInsert`, `daily_journal` table entry, `DailyJournal` export type |
| `src/app/(app)/agenda/agenda-client.tsx` | Agenda tabs (4 views) | Add "Disponibilidade" and "Folgas/Ferias" as 2 new tabs |
| `src/app/(app)/agenda/page.tsx` | Agenda server component | Fetch `user_availability` and `time_off` data in addition to existing queries |
| `src/app/(app)/disponibilidade/availability-client.tsx` | Availability settings form (275 lines) | Extract as importable component (currently self-contained, should work as tab content) |
| `src/app/(app)/disponibilidade/page.tsx` | Server page for disponibilidade | Keep route for backwards compat or redirect; server data fetching moves to agenda/page.tsx |
| `src/app/(app)/folgas/folgas-client.tsx` | Folgas calendar (305 lines) | Extract as importable component; add R008 logic to `handleSave` |
| `src/app/(app)/folgas/page.tsx` | Server page for folgas | Keep route or redirect; server data fetching moves to agenda/page.tsx |
| `src/app/(app)/clients/page.tsx` | Client list (101 lines) | Wrap in Tabs; add "Pipeline" tab importing PipelineClient |
| `src/app/(app)/pipeline/pipeline-client.tsx` | Kanban board (325 lines) | No logic changes; imported as tab content |
| `src/app/(app)/pipeline/page.tsx` | Pipeline server page | Keep route or redirect; data fetching moves to clients/page.tsx |
| `src/components/ui/tabs.tsx` | shadcn/ui Tabs (Radix) | **Already exists, no changes needed** |

### Build Order

1. **T01: Remove journaling** — Smallest, safest change. Delete dead file, clean references. No UI risk.
2. **T02: Agenda + Disponibilidade + Folgas tabs** — Most complex integration. Agenda page already has tabs, so adding 2 more is well-patterned. Requires merging 3 server-side data fetches into `agenda/page.tsx`.
3. **T03: Clients + Pipeline tab** — Same pattern as T02 but simpler (only 1 additional tab). Requires merging pipeline data fetch into `clients/page.tsx`.
4. **T04: Sidebar reduction to 9 items** — Final consolidation. Depends on T01-T03 being complete so removed routes are accessible via tabs. Update command palette simultaneously.
5. **T05: Folgas blocks disponibilidade (R008)** — Business logic change in `folgas-client.tsx` handleSave. After inserting into `time_off`, also upsert `user_availability` to set status="indisponivel" for that day. Can be done in parallel with T02-T04 but logically fits after T02 since both features will share the Agenda page.

### Target 9 Sidebar Items

Based on consolidation requirements, the target sidebar should be:
1. Dashboard (`/dashboard`)
2. Tracking Diario (`/logs`)
3. Jobs (`/jobs`)
4. Clientes (`/clients`) — with Pipeline tab
5. Invoices (`/invoices`)
6. Despesas (`/despesas`)
7. Agenda (`/agenda`) — with Tarefas/Disponibilidade/Folgas tabs
8. Relatorios (`/reports`)
9. Configuracoes (`/settings`)

Items removed: Diario, Pipeline, Projetos, Metas, Status de Agenda, Folgas/Ferias, Automacoes (7 removed = 16 - 7 = 9).

Note: Projetos, Metas, and Automacoes are removed from sidebar but their routes remain accessible via direct URL and command palette. This matches the requirement of consolidating the sidebar to 9 items without deleting features.

### Verification Approach

- **R004**: Grep for `daily_journal`, `journal-client`, `JournalClient`, `diary_entries` across `src/` — zero hits expected (except types.ts if we keep DB types for migration safety).
- **R005**: Count `navItems` array length in `sidebar.tsx` — must equal 9. Verify each consolidated page renders all expected tabs. Navigate to `/agenda` and confirm Disponibilidade and Folgas tabs load. Navigate to `/clients` and confirm Pipeline tab loads.
- **R008**: Create a folga via the UI, then check `user_availability` table — the day should be marked as unavailable. Remove the folga and verify availability reverts.
- **Regression**: All old routes (`/disponibilidade`, `/folgas`, `/pipeline`) should either redirect or still render standalone for bookmarked URLs.

## Common Pitfalls

1. **The `/diario` route serves dual purpose** — The page.tsx loads `daily_logs` (work tracking) not `daily_journal` (mood). Deleting the wrong thing breaks work tracking. Only `journal-client.tsx` is the journaling feature.
2. **Export API uses `diary_entries` not `daily_journal`** — The table name in the export route (line 33) is `diary_entries`, which differs from the type definition `daily_journal`. This is likely a pre-existing bug. Remove both references as part of R004.
3. **Agenda page already has complex tab state** — `agenda-client.tsx` uses `Tabs defaultValue="table"` with 4 existing tabs. Adding 2 more tabs means 6 total — consider whether this stays manageable or needs a different grouping (recommendation: keep it, 6 tabs is acceptable with icons).
4. **Server component data fetching explosion** — `agenda/page.tsx` currently fetches `agenda_events` and `jobs`. Adding disponibilidade and folgas requires 2-3 more queries (user_availability, time_off, year time_off). Use `Promise.all` to parallelize, matching existing pattern.
5. **Pipeline needs clients data** — `pipeline/page.tsx` fetches both `sales_pipeline` and `clients`. When embedding in clients/page.tsx, the clients data is already available from the parent query, but sales_pipeline needs a new fetch.
6. **Props threading for tab components** — `FolgasClient` expects `timeOff`, `yearTimeOff`, `currentMonth` props. `AvailabilityClient` expects `availability` prop. These must be fetched in the parent server component and passed down. The Agenda page will need URL search params for month navigation (folgas already uses `searchParams.month`).

## Constraints

- **No new route hierarchy** — Per architectural decision, tabs within existing pages, not nested routes.
- **shadcn/ui Tabs only** — Already installed and proven in agenda-client.tsx. No new dependencies needed.
- **Types from S01** — S01 completed, providing `src/lib/supabase/types.ts` with all 28 table types. Use these typed exports instead of inline interfaces where possible.
- **Sidebar item count must be exactly 9** — This is a hard requirement from R005, not approximate.
