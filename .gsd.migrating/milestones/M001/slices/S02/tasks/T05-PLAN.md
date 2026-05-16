---
estimated_steps: 7
estimated_files: 1
skills_used: []
---

# T05: Folgas blocks disponibilidade — auto-update user_availability on time_off insert

Why: R008 — currently folgas and disponibilidade are disconnected. A freelancer can appear available on a day they marked as folga. After creating a folga, the system must mark that day as unavailable.

Do:
1. In src/app/(app)/folgas/folgas-client.tsx: locate the handleSave/handleCreate function that calls supabase.from("time_off").insert(...).
2. After the successful time_off insert, for each date in the folga range, upsert into user_availability: set status to "indisponivel" for that user_id + date. Use supabase.from("user_availability").upsert({...}, { onConflict: "user_id,date" }) or equivalent.
3. When a folga is deleted (if there's a delete handler), revert the user_availability entry for those dates back to the default (either delete the override row or set status back to "disponivel").
4. Handle error cases: if the availability upsert fails, log to console but don't block the time_off save (best-effort sync per error handling strategy MEM003).

Done when: After inserting a time_off record, a corresponding user_availability record exists for that date. npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/folgas/folgas-client.tsx`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/app/(app)/folgas/folgas-client.tsx`

## Verification

npx tsc --noEmit
