# S06: Client Portal Melhorado — UAT

**Milestone:** M001
**Written:** 2026-05-16T19:58:24.907Z

# S06: Client Portal Melhorado — UAT

**Milestone:** M001
**Written:** 2026-05-16

## UAT Type

- UAT mode: live-runtime
- Why this mode is sufficient: Portal is a user-facing feature requiring real HTTP requests with token auth, PDF generation, and DB mutation — artifact inspection alone cannot prove the integration works end-to-end.

## Preconditions

- App running via `npm run dev`
- Supabase local or remote instance with migration 012 applied (`client_confirmed_at` column exists on invoices)
- At least one client with a valid portal token in `client_portal_tokens` table
- At least one invoice belonging to that client with status 'sent' or 'overdue'
- `SUPABASE_SERVICE_ROLE_KEY` set in environment (for admin client)

## Smoke Test

Navigate to `/portal/[valid-token]` — page loads showing client name, invoice list with download and confirm buttons.

## Test Cases

### 1. PDF Download

1. Navigate to `/portal/[valid-token]`
2. Click "Download PDF" on any invoice
3. **Expected:** Browser downloads a PDF file named `invoice-[number].pdf`. File opens correctly and shows invoice details matching the admin-generated PDF.

### 2. Payment Confirmation

1. Navigate to `/portal/[valid-token]`
2. Click "Confirmar Pagamento" on an unpaid invoice
3. **Expected:** Button changes to confirmed state (disabled, shows confirmation date). The `client_confirmed_at` column in the database is set to an ISO timestamp.

### 3. Invalid Token Access

1. Navigate to `/portal/invalid-token-xyz`
2. **Expected:** Page shows "not found" or empty state — no invoice data is exposed.

### 4. Cross-Client Invoice Protection

1. Using a valid token for Client A, attempt `GET /api/portal/pdf?token=[clientA-token]&invoice_id=[clientB-invoice-id]`
2. **Expected:** Returns 403 Forbidden — cannot access invoices belonging to other clients.

### 5. Admin PDF Route Unchanged

1. As authenticated admin, generate a PDF via the admin invoices route
2. **Expected:** PDF generates correctly using the refactored shared utility — no regression.

## Edge Cases

### Already Confirmed Invoice

1. Click "Confirmar Pagamento" on an invoice that was previously confirmed
2. **Expected:** Button is already in confirmed/disabled state showing the original confirmation date.

### Missing Invoice ID in API Call

1. Call `GET /api/portal/pdf?token=[valid]` without invoice_id
2. **Expected:** Returns 400 with "Missing parameters" error.

## Failure Signals

- Console errors on PDF download (fetch failure, blob creation error)
- 500 responses from portal API routes (service-role client misconfiguration)
- TypeScript compilation errors after changes
- `client_confirmed_at` not being set in database after confirmation

## Not Proven By This UAT

- Email notification to admin when client confirms payment (not implemented)
- PDF visual fidelity pixel-by-pixel (requires manual inspection)
- Load testing with many concurrent portal accesses
- Token expiration or revocation (tokens are currently permanent)

## Notes for Tester

- The portal is designed for single-user freelancer use — high concurrency is not a concern
- PDF generation depends on the `jspdf` library and correct invoice data in the database
- The `SUPABASE_SERVICE_ROLE_KEY` must have full access — the anon key will not work for portal routes
