---
estimated_steps: 6
estimated_files: 2
skills_used: []
---

# T02: Create reusable usePaginatedList hook and LoadMoreButton component

Why: No pagination infrastructure exists — every list fetches all rows. We need a shared hook and button before wiring into pages.

Do:
1. Create src/hooks/use-paginated-list.ts exporting usePaginatedList<T> with params: { table, select, filters, orderBy, pageSize = 25, initialData, initialCount }. Returns { items, loadMore, hasMore, loading }. Uses browser Supabase client with .range() and { count: 'exact' }. On mount, sets items to initialData. loadMore fetches next page and appends.
2. Create src/components/load-more-button.tsx — a button showing 'Carregar mais' with loading spinner, hidden when !hasMore. Uses shadcn/ui Button component for consistency.
3. Ensure both files are correctly typed with generics.

Done when: Both files exist, export correctly, and npx tsc --noEmit passes.

## Inputs

- `src/lib/supabase/client.ts`
- `src/lib/supabase/types.ts`

## Expected Output

- `src/hooks/use-paginated-list.ts`
- `src/components/load-more-button.tsx`

## Verification

npx tsc --noEmit
