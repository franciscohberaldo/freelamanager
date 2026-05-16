---
estimated_steps: 16
estimated_files: 2
skills_used: []
---

# T04: Reduce sidebar to 9 items and update command palette

Why: R005 final — after T01-T03, merged routes are accessible via tabs. Remove their standalone sidebar entries to reach exactly 9 items. Update command palette to match.

Do:
1. In src/components/layout/sidebar.tsx: set navItems to exactly these 9:
   - /dashboard (Dashboard, LayoutDashboard)
   - /logs (Tracking Diário, ClipboardList)
   - /jobs (Jobs, Briefcase)
   - /clients (Clientes, Users)
   - /invoices (Invoices, FileText)
   - /despesas (Despesas, Wallet)
   - /agenda (Agenda, CalendarDays)
   - /reports (Relatórios, TrendingUp)
   - /settings (Configurações, Settings)
2. Remove unused icon imports (BookText, KanbanSquare, Target, CalendarCheck, CalendarOff, Zap, FolderKanban).
3. In src/components/command-palette.tsx: remove entries for Diário (already done in T01), Pipeline, Projetos, Metas, Disponibilidade, Folgas, Automações. Keep entries that match the 9 sidebar items plus any action commands.
4. Rename the Agenda label from "Acomp. de Jobs" to "Agenda" in both sidebar and command palette.

Done when: navItems.length === 9 in sidebar.tsx. Command palette STATIC_LINKS matches new nav. npx tsc --noEmit exits 0.

## Inputs

- `src/components/layout/sidebar.tsx`
- `src/components/command-palette.tsx`

## Expected Output

- `src/components/layout/sidebar.tsx`
- `src/components/command-palette.tsx`

## Verification

npx tsc --noEmit
