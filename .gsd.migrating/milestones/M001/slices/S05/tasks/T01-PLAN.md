---
estimated_steps: 10
estimated_files: 1
skills_used: []
---

# T01: Enhance command palette search with multi-field queries and correct hrefs

Why: Command palette searches only the name field and links to list pages instead of detail pages — users can't find clients by company/email and can't navigate directly to a result.

Do:
1. Add user_id filtering: call supabase.auth.getUser() once on mount, cache in a ref, add .eq('user_id', userId) to all queries.
2. Expand client search: replace .ilike('name', ...) with .or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`).
3. Expand invoice search: use .or(`invoice_number.ilike.%${q}%,status.ilike.%${q}%`).
4. Fix client href: change from `/clients` to `/clients/${c.id}`.
5. Keep job href as `/jobs` (no detail route exists) and invoice href as `/invoices` (no detail route).
6. Add sub text: clients show company, invoices show status badge.
7. Remove the unsafe `(c as { company?: string })` cast — use the typed select.

Done when: Searching a partial company name returns matching clients. Client results link to /clients/[id]. Build compiles without errors.

## Inputs

- `src/components/command-palette.tsx`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/components/command-palette.tsx`

## Verification

npx tsc --noEmit
