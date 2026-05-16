---
estimated_steps: 10
estimated_files: 10
skills_used: []
---

# T03: Wire pagination into clients, jobs, invoices, logs, despesas, and pipeline pages

Why: With the hook and button created, each list page needs to be wired up: server component fetches first 25 with .range(0,24) + count, client component uses usePaginatedList for subsequent pages.

Do:
1. For clients/page.tsx: add .range(0, 24) and { count: 'exact' } to clients query. Pass totalCount to ClientsPageClient. Add LoadMoreButton at bottom of client list.
2. For jobs/page.tsx: same pattern — add .range(0, 24), pass initialCount, add a thin client wrapper if not present, wire LoadMoreButton.
3. For invoices/page.tsx: same pattern.
4. For logs/logs-client.tsx: logs are already month-scoped but can exceed 25. Add usePaginatedList with month filter. Server component passes first 25 + count.
5. For despesas/despesas-client.tsx: same as logs — month-scoped but paginated within month.
6. For pipeline/pipeline-client.tsx: pipeline is a kanban — add a high limit (50) per column rather than load-more. If total exceeds 50, show load-more per status group.
7. Ensure CSV export functions still fetch all data independently (not just loaded items) — add a separate full-fetch in export handlers.

Done when: Each list page shows max 25 items initially (50 for pipeline) with working Load More. npx tsc --noEmit passes. npx next build succeeds.

## Inputs

- `src/hooks/use-paginated-list.ts`
- `src/components/load-more-button.tsx`
- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/clients-page-client.tsx`
- `src/app/(app)/jobs/page.tsx`
- `src/app/(app)/invoices/page.tsx`
- `src/app/(app)/logs/page.tsx`
- `src/app/(app)/logs/logs-client.tsx`
- `src/app/(app)/despesas/page.tsx`
- `src/app/(app)/despesas/despesas-client.tsx`
- `src/app/(app)/pipeline/page.tsx`
- `src/app/(app)/pipeline/pipeline-client.tsx`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/app/(app)/clients/page.tsx`
- `src/app/(app)/clients/clients-page-client.tsx`
- `src/app/(app)/jobs/page.tsx`
- `src/app/(app)/invoices/page.tsx`
- `src/app/(app)/logs/page.tsx`
- `src/app/(app)/logs/logs-client.tsx`
- `src/app/(app)/despesas/page.tsx`
- `src/app/(app)/despesas/despesas-client.tsx`
- `src/app/(app)/pipeline/page.tsx`
- `src/app/(app)/pipeline/pipeline-client.tsx`

## Verification

npx next build
