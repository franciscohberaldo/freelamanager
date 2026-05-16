# S05: Command Palette & Paginacao

**Goal:** Cmd+K searches real data across multiple fields (clients by name/company/email, invoices by number/status) and links to detail pages. All list pages with >25 items show a Load More button for client-side incremental fetching.
**Demo:** Cmd+K busca e encontra cliente por nome. Lista de logs com 50+ items mostra carregar mais apos 25.

## Must-Haves

- 1. Command palette finds client by partial company name. 2. Clicking a client result navigates to /clients/[id]. 3. Clients page with >25 records shows exactly 25 + 'Carregar mais' button. 4. Clicking Load More fetches next page. 5. npx tsc --noEmit passes.

## Proof Level

- This slice proves: integration — real Supabase queries + UI interaction

## Integration Closure

Consumes typed queries from S01. Command palette uses browser Supabase client already mounted. Pagination hook uses same browser client. Server components add .range() for initial fetch. After S05, only S06 (Client Portal) remains for milestone completion.

## Verification

- Run the task and slice verification checks for this slice.

## Tasks

- [x] **T01: Enhance command palette search with multi-field queries and correct hrefs** `est:45m`
  Why: Command palette searches only the name field and links to list pages instead of detail pages — users can't find clients by company/email and can't navigate directly to a result.
  - Files: `src/components/command-palette.tsx`
  - Verify: npx tsc --noEmit

- [x] **T02: Create reusable usePaginatedList hook and LoadMoreButton component** `est:30m`
  Why: No pagination infrastructure exists — every list fetches all rows. We need a shared hook and button before wiring into pages.
  - Files: `src/hooks/use-paginated-list.ts`, `src/components/load-more-button.tsx`
  - Verify: npx tsc --noEmit

- [x] **T03: Wire pagination into clients, jobs, invoices, logs, despesas, and pipeline pages** `est:90m`
  Why: With the hook and button created, each list page needs to be wired up: server component fetches first 25 with .range(0,24) + count, client component uses usePaginatedList for subsequent pages.
  - Files: `src/app/(app)/clients/page.tsx`, `src/app/(app)/clients/clients-page-client.tsx`, `src/app/(app)/jobs/page.tsx`, `src/app/(app)/invoices/page.tsx`, `src/app/(app)/logs/page.tsx`, `src/app/(app)/logs/logs-client.tsx`, `src/app/(app)/despesas/page.tsx`, `src/app/(app)/despesas/despesas-client.tsx`, `src/app/(app)/pipeline/page.tsx`, `src/app/(app)/pipeline/pipeline-client.tsx`
  - Verify: npx next build

## Files Likely Touched

- src/components/command-palette.tsx
- src/hooks/use-paginated-list.ts
- src/components/load-more-button.tsx
- src/app/(app)/clients/page.tsx
- src/app/(app)/clients/clients-page-client.tsx
- src/app/(app)/jobs/page.tsx
- src/app/(app)/invoices/page.tsx
- src/app/(app)/logs/page.tsx
- src/app/(app)/logs/logs-client.tsx
- src/app/(app)/despesas/page.tsx
- src/app/(app)/despesas/despesas-client.tsx
- src/app/(app)/pipeline/page.tsx
- src/app/(app)/pipeline/pipeline-client.tsx
