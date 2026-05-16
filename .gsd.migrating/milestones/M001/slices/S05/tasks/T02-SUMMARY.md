---
id: T02
parent: S05
milestone: M001
key_files:
  - src/hooks/use-paginated-list.ts
  - src/components/load-more-button.tsx
key_decisions:
  - Used as unknown as RowType<T>[] cast per MEM005 convention for Supabase generic query results
  - Default pageSize=25 matching slice requirement for Load More after 25 items
  - Filter type uses column/op/value tuples mapped to Supabase .filter() for flexible query composition
duration: 
verification_result: passed
completed_at: 2026-05-16T19:34:04.531Z
blocker_discovered: false
---

# T02: Created reusable usePaginatedList hook with generic Supabase .range() pagination and LoadMoreButton component using shadcn/ui Button

**Created reusable usePaginatedList hook with generic Supabase .range() pagination and LoadMoreButton component using shadcn/ui Button**

## What Happened

Created two new files providing pagination infrastructure for the app:

1. **`src/hooks/use-paginated-list.ts`** — A generic `usePaginatedList<T>` hook parameterized over the `Database["public"]["Tables"]` keys. Accepts table name, select string, filters (column/op/value), orderBy, pageSize (default 25), initialData, and initialCount. Uses the browser Supabase client with `.range()` and `{ count: 'exact' }` for offset-based pagination. Returns `{ items, loadMore, hasMore, loading }`. The `loadMore` callback appends the next page to state. Uses `as unknown as RowType<T>[]` cast per the project's established convention (MEM005) for Supabase generic query results.

2. **`src/components/load-more-button.tsx`** — A simple component that renders a shadcn/ui `Button` with "Carregar mais" label and Loader2 spinner when loading. Hidden when `!hasMore`. Follows existing project patterns for button and spinner usage.

Initial type check failed due to Supabase's `GenericStringError[]` return type not overlapping with the row union — fixed by routing through `unknown` first, consistent with MEM005 gotcha.

## Verification

Ran `npx tsc --noEmit` which passed with exit code 0, confirming both files export correctly and all generics resolve without type errors.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 15000ms |

## Deviations

None.

## Known Issues

none

## Files Created/Modified

- `src/hooks/use-paginated-list.ts`
- `src/components/load-more-button.tsx`
