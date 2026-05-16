---
estimated_steps: 8
estimated_files: 4
skills_used: []
---

# T02: Consolidate Agenda page with Disponibilidade and Folgas tabs

Why: R005 — Disponibilidade and Folgas are currently standalone routes that fragment the scheduling experience. Both belong as tabs in the Agenda page, which already demonstrates the Tabs pattern with 4 views.

Do:
1. In src/app/(app)/agenda/page.tsx: add queries for user_availability (maybeSingle) and time_off (month + year ranges, same pattern as folgas/page.tsx). Use Promise.all alongside existing queries. Pass availability, timeOff, yearTimeOff, and currentMonth to AgendaClient.
2. In src/app/(app)/agenda/agenda-client.tsx: accept new props (availability, timeOff, yearTimeOff, currentMonth). Add two new TabsTrigger entries ("Disponibilidade" and "Folgas") to the existing TabsList. Add two TabsContent blocks that render <AvailabilityClient> and <FolgasClient> respectively with their props.
3. Import AvailabilityClient from src/app/(app)/disponibilidade/availability-client.tsx and FolgasClient from src/app/(app)/folgas/folgas-client.tsx.
4. Handle searchParams.month in agenda/page.tsx for folgas month navigation (match folgas/page.tsx pattern).
5. Keep standalone routes (/disponibilidade, /folgas) functional for backward compatibility — do not delete their page.tsx files.

Done when: /agenda renders 6 tabs (Tabela, Timeline, Gantt, Calendario, Disponibilidade, Folgas). npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/agenda/page.tsx`
- `src/app/(app)/agenda/agenda-client.tsx`
- `src/app/(app)/disponibilidade/availability-client.tsx`
- `src/app/(app)/disponibilidade/page.tsx`
- `src/app/(app)/folgas/folgas-client.tsx`
- `src/app/(app)/folgas/page.tsx`

## Expected Output

- `src/app/(app)/agenda/page.tsx`
- `src/app/(app)/agenda/agenda-client.tsx`

## Verification

npx tsc --noEmit
