# S06 Research — Client Portal Melhorado

## Summary

The client portal at `src/app/portal/[token]/page.tsx` is a server-rendered Next.js page that currently displays a read-only dashboard for a specific client: financial summary (total paid vs pending), contracted jobs, projects, and invoices with status badges. It authenticates via a UUID token stored in the `client_portal_tokens` table — the token is looked up with a public-read RLS policy (`for select using (true)`), and the resulting `client_id` + `user_id` pair is used to query all related data. The middleware at `src/middleware.ts` explicitly excludes `/portal` routes from auth redirects, so no login is required.

A fully functional PDF generation system already exists at `src/app/api/invoices/pdf/route.ts`. It uses `jspdf` + `jspdf-autotable` (both in package.json) to produce professional invoices with logo, accent color, line items, taxes, and i18n (PT/EN via `src/lib/invoice-i18n.ts`). However, this route is **auth-gated** — it calls `supabase.auth.getUser()` and returns 401 for unauthenticated requests. The portal page, being public/anonymous, cannot call this endpoint directly. A payment confirmation flow exists in the admin side (`PaymentDialog` in `src/app/(app)/invoices/invoice-actions.tsx`) that inserts into `invoice_payments` and auto-marks invoices as `paid` when fully covered. The `invoice_payments` table has RLS restricted to `auth.uid() = user_id`, so the portal cannot insert directly either.

The two core features for this slice — PDF download and payment confirmation — both require **new portal-specific API routes** that validate via token instead of auth session. The existing PDF generation logic (200+ lines) can be extracted into a shared utility and reused. Payment confirmation from the client side should be a lightweight "I confirm I paid" action (not the full PaymentDialog with amount/method/date), which records the client's claim and optionally updates invoice status to a new or existing state.

## Recommendation

Create two new API routes under `src/app/api/portal/` that authenticate via token parameter rather than session. Extract the PDF generation logic into a shared function. Add a client-facing confirmation action (not a full payment registration — the freelancer retains control over actual payment recording). Convert the portal page to include a client-side component for interactive actions (download buttons, confirm payment).

## Implementation Landscape

### Key Files

| File | Role | Change Needed |
|------|------|---------------|
| `src/app/portal/[token]/page.tsx` | Portal page (server component) | Add client component with download/confirm buttons per invoice |
| `src/app/api/invoices/pdf/route.ts` | PDF generation (auth-gated) | Extract core PDF logic into shared utility |
| `src/app/api/portal/pdf/route.ts` | **NEW** — Portal PDF endpoint | Token-validated PDF download |
| `src/app/api/portal/confirm-payment/route.ts` | **NEW** — Payment confirmation endpoint | Token-validated payment confirmation |
| `src/lib/invoice-pdf.ts` | **NEW** — Shared PDF generation utility | Extracted from existing route, reusable |
| `src/app/portal/[token]/portal-client.tsx` | **NEW** — Client component for portal interactivity | Download buttons, confirm payment UI |
| `src/lib/supabase/types.ts` | TypeScript types | Already complete (S01 dependency satisfied) |
| `src/lib/invoice-i18n.ts` | i18n strings for invoices | May need portal-specific strings |
| `src/middleware.ts` | Auth middleware | Already excludes `/portal` — no change needed |
| `supabase/migrations/010_crm.sql` | Portal token RLS | Already has public read — no change needed |

### Current Authentication Flow (Token-Based)

1. Middleware (`src/middleware.ts`) matcher excludes `/portal` paths — no auth redirect
2. Middleware (`src/lib/supabase/middleware.ts`) treats `/portal` as `isPublicPath` — allows anonymous access
3. Portal page queries `client_portal_tokens` with public-read RLS policy (`for select using (true)`)
4. Token lookup returns `{ client_id, user_id }` — these are used to scope all subsequent queries
5. Supabase client uses the anon key (not service role), relying on RLS policies

**Critical RLS gap**: The portal page currently works because `client_portal_tokens` has a public-read policy, and the portal queries `clients`, `jobs`, `invoices`, and `projects` tables. These tables have RLS policies like `auth.uid() = user_id` — which means the anon client should NOT be able to read them. This works only because the server component runs server-side where the Supabase client may have elevated privileges, OR because the anon key bypasses RLS on select. **This needs verification during implementation** — if the portal API routes (running as API handlers, not server components) cannot read these tables, a service-role client or explicit public-read policies scoped to portal tokens will be needed.

### Build Order

**Task 1: Extract PDF generation utility**
- Move the core PDF generation logic from `src/app/api/invoices/pdf/route.ts` into `src/lib/invoice-pdf.ts`
- The function should accept invoice data + settings + items as parameters (no Supabase dependency)
- Refactor the existing auth-gated route to use the new utility
- Verification: existing PDF download from admin side still works identically

**Task 2: Create portal PDF download API route**
- New route at `src/app/api/portal/pdf/route.ts`
- Accepts `token` and `invoice_id` as query params
- Validates token, confirms the invoice belongs to the token's client, fetches user_settings for branding
- Calls the shared PDF utility
- Returns the PDF as a downloadable response
- Verification: `GET /api/portal/pdf?token=xxx&invoice_id=yyy` returns a valid PDF

**Task 3: Create portal payment confirmation API route**
- New route at `src/app/api/portal/confirm-payment/route.ts`
- Accepts `token` and `invoice_id` in POST body
- Validates token, confirms the invoice belongs to the token's client
- Records the confirmation — options: (a) insert into `invoice_payments` with a special marker, (b) add a `client_confirmed_at` column to invoices, or (c) update invoice status to `"sent"` -> `"client_confirmed"`
- Recommended approach: add a `client_confirmed_at timestamptz` column to `invoices` table (new migration) — this is the simplest, avoids RLS issues with `invoice_payments`, and keeps the freelancer's payment tracking separate from client's claim
- Verification: POST returns success, invoice record updated

**Task 4: Build portal client component with interactive UI**
- New client component `src/app/portal/[token]/portal-client.tsx`
- Receives invoice list + token as props from the server component
- Renders download PDF button per invoice (calls portal PDF route)
- Renders "Confirmar pagamento" button for invoices with status `sent` or `overdue`
- Shows confirmation state after client confirms
- Update the server component to pass necessary data and render the client component
- Verification: buttons appear, PDF downloads, confirmation works end-to-end

### Verification Approach

1. **PDF download**: Navigate to portal page, click download on an invoice, verify PDF opens with correct data (invoice number, items, totals, branding)
2. **Payment confirmation**: Click confirm on a `sent` invoice, verify the confirmation is recorded, button changes to "Confirmado", refreshing the page preserves the state
3. **Security**: Attempt to download a PDF for an invoice not belonging to the portal's client — should return 403/404. Attempt to confirm payment with an invalid token — should return 404
4. **Existing admin flow**: Verify the admin PDF download, email send, and payment registration still work after the refactor

## Don't Hand-Roll

- **PDF generation**: Reuse the existing `jspdf` + `jspdf-autotable` setup — do NOT introduce a new PDF library. The existing code handles logos, accent colors, i18n, tax calculations, and line items.
- **Token validation**: Create a single shared helper (e.g., `validatePortalToken(token)`) that returns `{ client_id, user_id } | null` — reuse across all portal API routes.
- **Currency formatting**: Use the existing `formatCurrency` from `src/lib/utils.ts` (client-side) and the `formatCurrencyPDF` pattern (server-side).
- **i18n**: Use the existing `src/lib/invoice-i18n.ts` system.

## Common Pitfalls

1. **RLS blocking portal API routes**: The anon Supabase client cannot read `invoices`, `invoice_items`, `jobs`, `clients`, or `user_settings` tables (RLS requires `auth.uid() = user_id`). Portal API routes must either use a service-role client (`SUPABASE_SERVICE_ROLE_KEY`) or add scoped public-read policies. **Service role is simpler and safer** — the route validates the token first, then uses service role to fetch only the authorized data. Do NOT add broad public-read policies to financial tables.
2. **Invoice ID exposure**: The portal PDF route receives an `invoice_id` — always verify the invoice belongs to a job owned by the portal token's `client_id` before returning data. Never trust the invoice_id alone.
3. **Server component vs client component boundary**: The current portal page is a pure server component. Adding buttons requires a client component. Pass only serializable data (no Supabase client) to the client component.
4. **PDF route returning arraybuffer**: The existing route returns `doc.output("arraybuffer")` wrapped in `new NextResponse(pdfBytes, ...)`. The portal route should follow the same pattern exactly.
5. **Confirm vs Pay**: The client "confirms" they paid — this is NOT the same as the freelancer registering a payment. The freelancer still needs to verify and record the actual payment via the admin PaymentDialog. The client confirmation is informational/notification-like.

## Constraints

- **No new npm dependencies**: jspdf, jspdf-autotable, date-fns, and all UI components are already installed.
- **Supabase anon key limitations**: Portal routes cannot rely on `auth.uid()` — they are unauthenticated. Use service role key for data access after token validation.
- **Backward compatibility**: The existing admin PDF route (`/api/invoices/pdf`) must continue working identically after extracting the shared utility.
- **Migration needed**: If adding `client_confirmed_at` to invoices, a new migration file is required (e.g., `012_portal_confirmation.sql`).
- **No breaking the portal page**: The current read-only portal must keep working throughout incremental implementation.
