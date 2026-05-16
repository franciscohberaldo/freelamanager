# S05: Command Palette & Paginação — UAT

**Milestone:** M001
**Written:** 2026-05-16T19:45:14.214Z

# S05: Command Palette & Paginação — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: mixed (artifact-driven build verification + live-runtime interaction checks)
- Why this mode is sufficient: Build verification confirms type safety and compilation; manual checks confirm search behavior and pagination UX

## Preconditions

- App running via `npm run dev` or `npx next dev`
- At least 26+ clients in the database (to trigger Load More)
- At least 1 client with a known company name

## Smoke Test

Press Cmd+K, type a partial client company name → results appear with correct names and company labels.

## Test Cases

### 1. Command palette finds client by company name

1. Press Cmd+K to open command palette
2. Type a partial company name (e.g., first 3 characters)
3. **Expected:** Client(s) matching that company appear in results with name and company shown

### 2. Command palette navigates to client detail

1. Press Cmd+K, search for a known client
2. Click/select the client result
3. **Expected:** Browser navigates to `/clients/[id]` (the client detail page, not the list)

### 3. Command palette searches invoices by number

1. Press Cmd+K, type an invoice number (e.g., "INV-")
2. **Expected:** Matching invoices appear with number and status labels

### 4. Clients list shows Load More after 25

1. Navigate to /clients (with 26+ clients in DB)
2. **Expected:** Exactly 25 clients shown initially with a "Carregar mais" button visible
3. Click "Carregar mais"
4. **Expected:** Next batch of clients loads below; button disappears if all loaded

### 5. Logs list paginates correctly

1. Navigate to /logs (with 26+ log entries)
2. **Expected:** 25 entries shown with "Carregar mais" button
3. Click the button
4. **Expected:** Additional entries appear

### 6. Pipeline loads without Load More button

1. Navigate to /pipeline
2. **Expected:** Up to 50 deals displayed in kanban columns; no "Carregar mais" button present

## Edge Cases

### Empty search results

1. Press Cmd+K, type a string that matches no records (e.g., "zzzzzzz")
2. **Expected:** Empty state shown, no errors in console

### Fewer than 25 items

1. Navigate to a list page with fewer than 25 records
2. **Expected:** All items shown, no "Carregar mais" button visible

### Rapid Load More clicks

1. On a paginated page, click "Carregar mais" rapidly twice
2. **Expected:** No duplicate items appear; loading state prevents double-fetch

## Failure Signals

- Command palette shows no results for known existing clients
- Clicking a client result navigates to /clients list instead of /clients/[id]
- Load More button missing on pages with >25 items
- Duplicate items appearing after pagination
- Console errors related to Supabase queries or type mismatches
- Build failure (`npx next build` or `npx tsc --noEmit` returning non-zero)

## Not Proven By This UAT

- Performance under large datasets (1000+ records)
- Command palette keyboard navigation (arrow keys, enter to select)
- Offline/network-error behavior during pagination fetch
- CSV export behavior with paginated data (exports currently-loaded items only)

## Notes for Tester

- CSV export on paginated pages exports only the currently-loaded items, not all records. This is acceptable for a single-user app with <100 records per entity.
- Pipeline intentionally uses a higher limit (50) without Load More since kanban doesn't suit incremental loading.
- Job and invoice command palette results link to list pages (not detail pages) because no `/jobs/[id]` or `/invoices/[id]` detail routes exist.
