# S02: Consolidar Navegacao — UAT

**Milestone:** M001
**Written:** 2026-05-16T12:56:33.491Z

# S02: Consolidar Navegacao — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: Changes are structural (sidebar items, tab composition, type removal) verifiable through static analysis — tsc --noEmit, grep, and code inspection confirm correctness without requiring a running server.

## Preconditions

- Project builds without type errors (`npx tsc --noEmit` exits 0)
- Supabase types file exists at `src/lib/supabase/types.ts`

## Smoke Test

Open the app and verify the sidebar shows exactly 9 items. Click "Agenda" and see 6 tabs. Click "Clientes" and see 2 tabs (Clientes, Pipeline).

## Test Cases

### 1. Sidebar has exactly 9 items

1. Open the sidebar
2. Count navigation items
3. **Expected:** Exactly 9 items — Dashboard, Tracking Diário, Jobs, Clientes, Invoices, Despesas, Agenda, Relatórios, Configurações

### 2. Agenda page shows Disponibilidade and Folgas tabs

1. Navigate to /agenda
2. Observe the tab bar
3. **Expected:** 6 tabs visible — Tabela, Timeline, Gantt, Calendário, Disponibilidade, Folgas
4. Click "Disponibilidade" tab
5. **Expected:** Availability management UI renders
6. Click "Folgas" tab
7. **Expected:** Time-off management UI renders

### 3. Clients page shows Pipeline tab

1. Navigate to /clients
2. Observe the tab bar
3. **Expected:** 2 tabs — Clientes, Pipeline
4. Click "Pipeline" tab
5. **Expected:** Kanban board renders with deal stages

### 4. Journaling feature fully removed

1. Search for /diario in browser
2. **Expected:** Page loads but shows only TrackingClient (work hours), no journal/mood UI
3. Check sidebar for "Diário" or "Journal" entry
4. **Expected:** Not present — only "Tracking Diário" for the /logs route

### 5. Folga creation marks day as unavailable

1. Navigate to Agenda > Folgas tab
2. Create a new folga for today's date
3. **Expected:** After successful creation, user_availability status is updated to 'indisponivel'
4. Switch to Disponibilidade tab
5. **Expected:** Status shows as unavailable for today

### 6. Folga deletion reverts availability

1. Delete the folga created in test 5
2. **Expected:** user_availability status reverts to 'disponivel'
3. Switch to Disponibilidade tab
4. **Expected:** Status shows as available again

## Edge Cases

### Folga for future date does not change today's availability

1. Create a folga for a date in the future (not today)
2. **Expected:** user_availability status remains unchanged — sync only fires for today

### Command palette matches sidebar

1. Press Cmd+K (or Ctrl+K)
2. **Expected:** Quick links match the 9 sidebar items exactly

## Failure Signals

- Sidebar shows more or fewer than 9 items
- Agenda page missing Disponibilidade or Folgas tabs
- Clients page missing Pipeline tab
- `grep` for journaling identifiers finds matches in src/
- `npx tsc --noEmit` fails with type errors
- Creating a folga for today doesn't update availability status

## Not Proven By This UAT

- Runtime behavior of the availability sync (would need integration test with real Supabase)
- Server-side overnight sync for folgas becoming active the next day
- Visual/pixel-level rendering of tabs and sidebar
- Performance of the consolidated pages with large datasets

## Notes for Tester

- The standalone routes /disponibilidade and /folgas still work but are no longer in the sidebar — this is intentional for backward compatibility
- The availability sync is client-side only and scoped to today's date — a known limitation documented in the slice summary
