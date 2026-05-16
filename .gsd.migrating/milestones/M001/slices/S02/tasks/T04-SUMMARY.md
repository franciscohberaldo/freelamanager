---
id: T04
parent: S02
milestone: M001
key_files:
  - src/components/layout/sidebar.tsx
  - src/components/command-palette.tsx
key_decisions:
  - Also removed dynamic Supabase projects query from command palette since /projetos route is no longer in nav
  - Added Despesas entry to command palette STATIC_LINKS to match sidebar (was missing before)
duration: 
verification_result: passed
completed_at: 2026-05-16T12:47:41.718Z
blocker_discovered: false
---

# T04: Reduced sidebar to exactly 9 nav items and updated command palette to match

**Reduced sidebar to exactly 9 nav items and updated command palette to match**

## What Happened

Read both sidebar.tsx and command-palette.tsx to understand current state. sidebar.tsx had 15 navItems; command-palette.tsx STATIC_LINKS had 9 entries but still included Projetos and was missing Despesas. 

Changes to sidebar.tsx:
1. Cleaned icon imports — removed BookText (already gone from T01), KanbanSquare, Target, CalendarCheck, CalendarOff, Zap, FolderKanban. Kept only the 9 icons needed.
2. Replaced navItems array (15 entries) with exactly 9: /dashboard, /logs, /jobs, /clients, /invoices, /despesas, /agenda, /reports, /settings.
3. Renamed /agenda label from "Acomp. de Jobs" to "Agenda".

Changes to command-palette.tsx:
1. Removed FolderKanban from lucide-react imports; added Wallet.
2. Removed STATIC_LINKS entry for Projetos (/projetos); added Despesas (/despesas, Wallet icon).
3. Renamed "Acomp. de Jobs" to "Agenda" for the /agenda entry.
4. Removed dynamic projects search from Supabase Promise.all (was querying projects table and returning FolderKanban results pointing to /projetos).

TypeScript check (npx tsc --noEmit) passed with zero errors.

## Verification

Ran npx tsc --noEmit — exited 0 with no output (no errors). Verified navItems array has exactly 9 entries. Verified STATIC_LINKS has exactly 9 entries matching the sidebar. Verified all removed icon imports are gone from both files.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | No TypeScript errors | 15000ms |

## Deviations

Added Despesas to command palette STATIC_LINKS — it was already in the sidebar before T04 but missing from the palette. This aligns the palette with the 9-item nav as required.

## Known Issues

None.

## Files Created/Modified

- `src/components/layout/sidebar.tsx`
- `src/components/command-palette.tsx`
