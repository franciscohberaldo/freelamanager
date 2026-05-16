# S05 Research — Command Palette & Pagination

## Summary

The command palette (`src/components/command-palette.tsx`) already has a working implementation that opens via Cmd+K/Ctrl+K, searches four Supabase tables (jobs, clients, invoices, projects) using `.ilike()` with a 200ms debounce, and supports keyboard navigation. However, it has several gaps that R011 targets: (1) search on jobs/clients only matches the `name` field — clients should also match `company` and `email`; (2) invoices only match `invoice_number` but not client/job names or amounts; (3) result links for jobs and clients point to the list page (`/jobs`, `/clients`) instead of detail pages (there are no `/jobs/[id]` or `/invoices/[id]` routes — only `/clients/[id]` and `/projetos/[id]` exist); (4) there is no `user_id` filter on any search query, which is a security gap in a multi-tenant app. The component is custom-built on top of `@radix-ui/react-dialog` — there is no `cmdk` package installed. The current implementation is functional enough that enhancements can be made in-place rather than rewriting.

For pagination (R012), every list page in the app currently fetches **all rows** from Supabase with no limit. All list pages use Next.js server components that call `createClient()` from `@/lib/supabase/server` and pass data down to client components. There is zero pagination infrastructure — no `.range()` calls, no "load more" buttons, no offset/cursor state. The pages that need pagination are: **clients** (server-rendered flat list), **jobs** (server-rendered flat list), **invoices** (server-rendered flat list), **logs** (server-component fetch, client-rendered via `LogsClient`), **despesas** (server-component fetch, client-rendered via `DespesasClient`), and **pipeline** (server-component fetch, client-rendered via `PipelineClient`). Pages that do NOT need pagination: dashboard (aggregates), projetos (typically few items), agenda (calendar view), diario (month-scoped), metas (single record per month), folgas (month-scoped), disponibilidade (single record), automacoes (already uses `.limit(20)` on logs), settings, reports.

The architecture challenge is that the current server-component pattern fetches all data at build/request time. Adding "load more" requires either: (a) converting these pages to client components that fetch incrementally via the browser Supabase client, or (b) keeping the server component for the initial page of 25, then using a client "load more" button that calls Supabase directly for subsequent pages. Option (b) is preferred — it preserves SSR for the first paint, is minimal disruption, and matches the existing pattern where server components pass initial data to client components.

## Recommendation

Split into 3 tasks: (T01) Fix command palette search — add `user_id` filters, expand search fields with `.or()`, fix result hrefs for clients/projects; (T02) Create a reusable `usePaginatedList` hook + `LoadMoreButton` component; (T03) Wire pagination into the 6 target list pages.

## Implementation Landscape

### Key Files

**Command Palette (R011):**
- `src/components/command-palette.tsx` — the single file to modify. Contains all search logic, result mapping, and rendering.
- `src/components/layout/sidebar.tsx` — mounts `<CommandPalette />` at line 116. No changes needed.
- `src/lib/supabase/client.ts` — browser Supabase client used by the palette. No changes needed.

**Pagination (R012) — Pages that need it:**
- `src/app/(app)/clients/page.tsx` — server component, fetches all clients with `select("*, client_contacts(*)")`, renders flat card list. No client wrapper component — renders directly in JSX.
- `src/app/(app)/jobs/page.tsx` — server component, fetches all jobs + all clients (for dialog). Renders flat card list directly.
- `src/app/(app)/invoices/page.tsx` — server component, fetches all invoices + payments + jobs. Renders flat card list directly.
- `src/app/(app)/logs/page.tsx` + `src/app/(app)/logs/logs-client.tsx` — server component fetches month-scoped logs, passes to `LogsClient`. Already month-filtered, but within a month could have 100+ entries.
- `src/app/(app)/despesas/page.tsx` + `src/app/(app)/despesas/despesas-client.tsx` — server fetches month-scoped expenses, passes to `DespesasClient`.
- `src/app/(app)/pipeline/page.tsx` + `src/app/(app)/pipeline/pipeline-client.tsx` — server fetches all pipeline deals, passes to `PipelineClient`. Pipeline is a Kanban board so pagination here may be "load more per column" or simply a high limit.

**Shared infrastructure (to create):**
- `src/hooks/use-paginated-list.ts` — new custom hook for client-side incremental fetching.
- `src/components/load-more-button.tsx` — new reusable "load more" UI component.

### Existing Patterns and Constraints

1. **Server components own the initial fetch.** Every list page is an `async function` server component. The pagination pattern must keep the server component fetching the first page (add `.range(0, 24)` to queries) while a client component handles subsequent pages.

2. **No detail routes for jobs/invoices.** Routes exist for `/clients/[id]` and `/projetos/[id]`, but NOT for `/jobs/[id]` or `/invoices/[id]`. The command palette currently links jobs to `/jobs` and invoices to `/invoices` (the list pages). For S05, keep these as-is — linking to the list page is acceptable since there are no detail routes. If detail routes are added later, update the hrefs.

3. **Supabase `.range(from, to)` for pagination.** The Supabase JS client supports `.range(0, 24)` for the first 25 items, `.range(25, 49)` for the next 25, etc. This pairs with `.select("*", { count: "exact" })` to get total count in the response headers. The count is returned as `response.count`.

4. **Supabase `.or()` for multi-field search.** The command palette currently uses `.ilike("name", ...)` on a single field. For clients, use `.or(`name.ilike.%${q}%,company.ilike.%${q}%,email.ilike.%${q}%`)` to search across multiple columns in one query.

5. **No `cmdk` dependency.** The palette is hand-rolled on `@radix-ui/react-dialog`. This is fine — the implementation is clean and works. Do NOT introduce cmdk; enhance the existing component.

6. **Security: missing `user_id` filter.** The command palette queries (`lines 77-82`) do NOT filter by `user_id`. If RLS is not enforced, this is a data leak. Add `.eq("user_id", userId)` to every search query — but this requires getting the user ID in a client component. Use `supabase.auth.getUser()` or rely on RLS policies (check if RLS is enabled). At minimum, note this and add the filter if feasible (call `supabase.auth.getUser()` once on mount and cache it).

### Build Order

**Task 1 — Command Palette Search Enhancements (R011)**
- Add `user_id` filter via `supabase.auth.getUser()` called once on component mount, cached in a ref.
- Expand client search to use `.or()` across name, company, email fields.
- Expand invoice search to also search by status or join with job name (or keep simple with invoice_number + status).
- Fix result `href` for clients: change from `/clients` to `/clients/${c.id}`.
- Fix result `href` for projects: already correct at `/projetos/${p.id}`.
- Consider adding `sub` text showing more context (e.g., client company, invoice total, job client name).

**Task 2 — Pagination Infrastructure (R012 foundation)**
- Create `src/hooks/use-paginated-list.ts`:
  ```
  usePaginatedList<T>({ table, select, filters, orderBy, pageSize = 25 })
  → { items: T[], loadMore: () => void, hasMore: boolean, loading: boolean }
  ```
  Uses browser Supabase client with `.range()` and `.select("*", { count: "exact" })`.
- Create `src/components/load-more-button.tsx` — a simple button that shows "Carregar mais" with a loading spinner, disabled when `!hasMore`.

**Task 3 — Wire Pagination into List Pages**
- For each of the 6 target pages:
  1. Server component adds `.range(0, 24)` and `{ count: "exact" }` to initial query.
  2. Server component passes `initialItems` and `totalCount` to a client wrapper.
  3. Client wrapper uses `usePaginatedList` (starting from offset 25) when "load more" is clicked.
- Pages already using client wrappers (logs, despesas, pipeline) are easier — just modify the props interface and add load-more at the bottom.
- Pages rendering directly (clients, jobs, invoices) need a new thin client wrapper component to manage the load-more state.

### Verification Approach

- **Command palette:** Open Cmd+K, type a partial client name → should see matching clients with company shown as subtitle. Type an invoice number → should match. Click a client result → should navigate to `/clients/[id]`. Verify no results leak across users (if testable).
- **Pagination:** Navigate to clients page with >25 clients → should see exactly 25 + a "Carregar mais" button. Click button → 25 more load. When all loaded, button disappears. Count in header ("X clientes cadastrados") should show total count, not just visible count.
- **Edge cases:** Empty search in command palette → shows static page links. List with exactly 25 items → no load-more button. List with 0 items → empty state still shows.

### Common Pitfalls

1. **Supabase `.or()` syntax is a raw string**, not chained methods. It must be: `.or('name.ilike.%val%,company.ilike.%val%')` — note the backtick-wrapped string with no spaces after commas. Incorrect syntax silently returns no results.
2. **`.range()` is inclusive on both ends.** `.range(0, 24)` returns 25 items (indices 0 through 24). Off-by-one errors here are very common.
3. **`{ count: "exact" }` goes in `.select()` options**, not as a separate method. Usage: `.select("*", { count: "exact" })`. The count is on the response object: `response.count`.
4. **Server components cannot use hooks.** The "load more" logic MUST live in a client component. For pages like clients/jobs/invoices that currently render entirely in the server component, a new client wrapper is needed.
5. **CSV export currently exports all items.** After pagination, the CSV export button on clients and invoices pages will only have the loaded items. Either: (a) fetch all for export separately, or (b) note this as a known limitation for now. Recommend (a) — the export handler should do its own full fetch.

### Don't Hand-Roll

- Do NOT introduce `cmdk` or any new dependency — the existing Dialog-based palette works well.
- Do NOT implement cursor-based pagination — offset-based with `.range()` is simpler and sufficient for this data scale.
- Do NOT convert server components to fully client-rendered pages — keep the SSR first-page pattern.
- Do NOT add full-text search (pg_trgm / tsvector) — `.ilike()` with `.or()` is adequate for the expected data volumes (hundreds, not millions of rows).
