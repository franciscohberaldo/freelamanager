# S01: Types & Bug Fixes — UAT

**Milestone:** M001
**Written:** 2026-05-16T12:36:34.213Z

# S01: Types & Bug Fixes — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice is entirely about compile-time type safety and a display formatting fix — both are fully verifiable through static analysis (tsc), grep, and build success without requiring a running server.

## Preconditions

- Node.js and npm installed
- Project dependencies installed (`npm install`)
- No running server required (all checks are static/build-time)

## Smoke Test

Run `npx tsc --noEmit` — should exit 0 with no errors, confirming all types are complete and consistent.

## Test Cases

### 1. Zero `as any` casts in codebase

1. Run `grep -rn "as any" src/`
2. **Expected:** Zero matches returned

### 2. TypeScript compiles clean

1. Run `npx tsc --noEmit`
2. **Expected:** Exit code 0, no type errors printed

### 3. Production build succeeds

1. Run `npx next build`
2. **Expected:** Build completes successfully with all pages listed in output

### 4. PaymentDialog uses invoice currency

1. Open `src/app/(app)/invoices/invoice-actions.tsx`
2. Find the PaymentDialog currency formatting
3. **Expected:** `formatCurrency` is called with `invoice.currency` (not a hardcoded 'BRL')

### 5. All 28 tables have types

1. Open `src/lib/supabase/types.ts`
2. Count table entries in the Database interface
3. **Expected:** 28 tables with Row/Insert/Update shapes each

## Edge Cases

### Invoice with USD currency

1. An invoice with `currency: 'USD'` is displayed in PaymentDialog
2. **Expected:** Amount formatted as `$1,234.56` (not `R$ 1.234,56`)

### Invoice with EUR currency

1. An invoice with `currency: 'EUR'` is displayed in PaymentDialog
2. **Expected:** Amount formatted as `€1,234.56`

## Failure Signals

- `npx tsc --noEmit` reports type errors
- `grep -rn "as any" src/` finds matches
- `npx next build` fails
- PaymentDialog still shows R$ for non-BRL invoices

## Not Proven By This UAT

- Runtime behavior of the PaymentDialog in a browser (visual verification deferred)
- Supabase query results actually matching the type shapes at runtime
- Currency formatting locale correctness across all possible locales

## Notes for Tester

- The `as unknown as T` pattern used for FK join mismatches is intentional — Supabase codegen represents many-to-one FK joins as arrays. The explicit target type is the correct workaround.
- invoice_sequences is the 28th table (plan said 27) — it existed in the original file and is a real table.
