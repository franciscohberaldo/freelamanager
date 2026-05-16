---
estimated_steps: 14
estimated_files: 5
skills_used: []
---

# T04: Visual polish, build verification, and browser smoke test

**Why:** Final integration task — ensure the complete dashboard works end-to-end, both tabs render correctly, the build succeeds, and there are no TypeScript errors or visual regressions.

**Do:**
1. Review all new components for consistent styling: card spacing, text sizes, icon colors match existing dashboard aesthetic.
2. Ensure Tab default is 'hoje' and URL doesn't change between tabs.
3. Verify formatCurrency uses correct currency per invoice (not hardcoded BRL) — cross-check with S01 fix.
4. Run `npx tsc --noEmit` — must exit 0 with zero errors.
5. Run `npx next build` — must succeed with all pages compiling.
6. Start dev server, open /dashboard in browser:
   - Verify 'Hoje' tab loads by default
   - Verify daily KPIs, agenda, overdue invoices, revenue-at-risk, goal progress render (or empty states)
   - Switch to 'Mensal' tab — verify charts, KPIs, invoices, events render as before
   - Switch back to 'Hoje' — verify instant switch, no reload
7. Fix any visual issues found during browser testing.

**Done when:** npx tsc --noEmit exits 0. npx next build succeeds. Both dashboard tabs render correctly in browser.

## Inputs

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/daily-view.tsx`
- `src/app/(app)/dashboard/monthly-view.tsx`
- `src/app/(app)/dashboard/revenue-at-risk.tsx`

## Expected Output

- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/dashboard/dashboard-client.tsx`
- `src/app/(app)/dashboard/daily-view.tsx`
- `src/app/(app)/dashboard/monthly-view.tsx`
- `src/app/(app)/dashboard/revenue-at-risk.tsx`

## Verification

npx next build
