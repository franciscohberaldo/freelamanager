---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T02: Add Timer settings card to Settings page

Why: User needs a way to configure the max timer hours (R009 configurability). Settings page already has multiple cards; adding one more follows the established pattern.

Do:
1. Create a new client component src/app/(app)/settings/timer-settings.tsx that reads localStorage 'timer_max_hours' on mount and renders a Card with a number input (min 1, max 24, step 0.5, default 8). On change, persist to localStorage immediately.
2. Import and render <TimerSettings /> in src/app/(app)/settings/page.tsx after the 'Alterar senha' card.
3. Use shadcn Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Label components.

Done when: /settings shows a Timer card with functioning number input that persists to localStorage on change.

## Inputs

- `src/app/(app)/settings/page.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`

## Expected Output

- `src/app/(app)/settings/timer-settings.tsx`
- `src/app/(app)/settings/page.tsx`

## Verification

npx tsc --noEmit
