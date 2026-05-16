---
estimated_steps: 9
estimated_files: 5
skills_used: []
---

# T01: Remove journaling feature and clean all references

Why: R004 — daily_journal/mood is dead code that clutters sidebar and types. The /diario route serves work tracking (TrackingClient), not journaling.

Do:
1. Delete src/app/(app)/diario/journal-client.tsx
2. In sidebar.tsx: remove the navItem { href: "/diario", label: "Diário", icon: BookText } (line 20)
3. In command-palette.tsx: remove the entry { id: "diario", label: "Diário", href: "/diario", ... } (line 26)
4. In src/app/api/export/route.ts: remove diary_entries fetch (line 33), diaryEntries variable (line 21), and diary_entries key from the response object (line 51)
5. In src/lib/supabase/types.ts: remove DailyJournalRow type (line 133-137), DailyJournalInsert type (line 138-142), daily_journal entry in Database Tables map (line 308), and DailyJournal export (line 350)
6. Remove the BookText icon import from sidebar.tsx if no longer used

Done when: grep -rn "journal-client\|DailyJournal\|diary_entries\|daily_journal" src/ returns zero matches. npx tsc --noEmit exits 0.

## Inputs

- `src/app/(app)/diario/journal-client.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/command-palette.tsx`
- `src/app/api/export/route.ts`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/components/layout/sidebar.tsx`
- `src/components/command-palette.tsx`
- `src/app/api/export/route.ts`
- `src/lib/supabase/types.ts`

## Verification

npx tsc --noEmit
