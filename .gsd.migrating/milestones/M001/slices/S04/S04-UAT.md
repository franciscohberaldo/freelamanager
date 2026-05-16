# S04: Timer & Notificacoes — UAT

**Milestone:** M001
**Written:** 2026-05-16T19:29:48.252Z

# S04: Timer & Notificacoes — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: mixed (artifact-driven for type safety + live-runtime for behavior)
- Why this mode is sufficient: Timer auto-stop and badge rendering are client-side behaviors verifiable via browser; type safety proven by tsc --noEmit

## Preconditions

- App running locally (`npm run dev`)
- User logged in with active Supabase session
- At least one invoice with status "overdue" in the database
- At least one job/deal not updated in 7+ days in the database

## Smoke Test

Open the app — sidebar should show a red badge next to "Invoices" with the overdue count. Start the timer on the Logs page and confirm it ticks.

## Test Cases

### 1. Timer auto-stop at default 8h

1. Clear localStorage key `timer_max_hours` (or ensure it's absent)
2. Start the timer on the Logs page
3. Manually set the timer start to 8h+ ago via devtools (or wait — impractical)
4. **Expected:** Timer stops automatically, warning toast appears, timer resets to inactive state, hours are NOT saved to DB

### 2. Timer auto-stop at custom limit

1. Go to Settings page
2. Find the "Timer" card and set max hours to 1
3. Start the timer on Logs page
4. Wait 1 hour (or simulate via devtools)
5. **Expected:** Timer auto-stops at 1h with warning toast

### 3. Timer settings persistence

1. Go to Settings page
2. Set max hours to 4
3. Refresh the page
4. **Expected:** Timer card still shows 4 as the configured value (read from localStorage)

### 4. Sidebar badge — overdue invoices

1. Ensure at least one invoice has status "overdue" in DB
2. Navigate to any page
3. **Expected:** Red badge with count appears next to "Invoices" in sidebar

### 5. Sidebar badge — stalled deals

1. Ensure at least one job has `updated_at` older than 7 days and status not "completed"
2. Navigate to any page
3. **Expected:** Red badge with count appears next to "Clientes" in sidebar

### 6. Sidebar badge — no badges when counts are zero

1. Ensure no overdue invoices and no stalled deals exist
2. Navigate to any page
3. **Expected:** No badges appear in sidebar (clean nav items)

## Edge Cases

### Timer already stopped manually before max

1. Start timer, then stop it manually before hitting the limit
2. **Expected:** Normal stop behavior — hours saved to DB, no auto-stop toast

### localStorage cleared mid-session

1. Start timer
2. Clear localStorage in devtools
3. **Expected:** Timer falls back to default 8h max (reads on each tick or uses ref initialized at mount)

### Max hours set to 0 or negative

1. Go to Settings, try to set max hours to 0 or -1
2. **Expected:** Input enforces minimum value or falls back to default 8h

## Failure Signals

- TypeScript compilation errors in modified files
- Timer never stops despite exceeding configured max
- Badges showing incorrect counts or appearing on wrong nav items
- Console errors from Supabase count queries (auth/permission issues)

## Not Proven By This UAT

- Real 8-hour wait for auto-stop (simulated via devtools or time manipulation)
- Badge real-time update without page navigation (no subscription/polling beyond mount)
- Mobile/responsive rendering of badge positioning
- Performance under large dataset counts (thousands of overdue invoices)

## Notes for Tester

- Auto-stop is easiest to test by temporarily setting max hours to a very low value (e.g., 0.01 = ~36 seconds) in Settings
- Badge counts refresh on sidebar mount — navigating away and back will refresh counts
- Auto-stop intentionally does not save hours to prevent corrupted time data from forgotten timers
