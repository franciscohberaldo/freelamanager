---
id: T05
parent: S02
milestone: M001
key_files:
  - src/app/(app)/folgas/folgas-client.tsx
key_decisions:
  - Adapted plan from per-date user_availability upserts to singleton status update — schema has no date column, only a general status per user
  - Only sync availability when the affected date is today — changing general status for a future folga would be incorrect
  - On delete revert, default to 'disponivel' rather than trying to restore previous status — simpler and follows MEM003 principle
  - Converted inline trash button handler from .then() to async/await for consistency with the sync call pattern
duration: 
verification_result: passed
completed_at: 2026-05-16T12:52:45.018Z
blocker_discovered: false
---

# T05: Added auto-sync of user_availability status when folgas are created or deleted for today's date

**Added auto-sync of user_availability status when folgas are created or deleted for today's date**

## What Happened

The task plan specified per-date upserts into user_availability, but the actual schema has no `date` column — it's a singleton row per user with a general `status` field. Adapted the implementation to the real schema:

1. Added `syncAvailabilityForDate()` helper outside the component that:
   - Checks if the affected date is today (no-op for future/past dates since the singleton status represents current availability)
   - Queries remaining time_off records for today after the insert/delete
   - Upserts user_availability: sets status to "indisponivel" if any time_off exists for today, or "disponivel" if none remain
   - Logs errors to console without blocking the time_off save (per MEM003 error strategy)

2. Wired the helper into all three mutation paths:
   - `handleSave()` — called after successful new time_off insert (not on updates, since date doesn't change)
   - `handleDelete()` — called after successful dialog-based delete
   - Inline trash button — converted from `.then()` to async/await and added the sync call

The sync is best-effort: if the availability upsert fails, the time_off operation still succeeds and the error is logged to console.

## Verification

Ran `npx tsc --noEmit` — exited 0 with no errors. All three mutation paths in folgas-client.tsx now call syncAvailabilityForDate after successful time_off changes.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

Plan specified per-date upserts with onConflict: 'user_id,date' but user_availability has no date column — adapted to upsert the singleton row's status field, scoped to today-only changes.

## Known Issues

The sync only affects today's date. If a user creates a folga for tomorrow and then tomorrow arrives, the user_availability status won't auto-update — this would require a server-side cron job or database trigger, which is outside the scope of this client-side task.

## Files Created/Modified

- `src/app/(app)/folgas/folgas-client.tsx`
