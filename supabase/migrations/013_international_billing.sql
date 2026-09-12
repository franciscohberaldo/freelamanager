-- International billing: daily-rate jobs, project code, bank details on invoice PDF

alter table jobs
  add column if not exists billing_mode text not null default 'hourly'
    check (billing_mode in ('hourly', 'daily')),
  add column if not exists project_code text;

-- Invoice line items can be expressed in hours (default) or days.
-- hours_billed is kept for reporting compatibility (1 day = 8 hours).
alter table invoice_items
  add column if not exists quantity numeric(8,2),
  add column if not exists unit text check (unit in ('hour', 'day'));

-- Bank details printed in the "Payment details" block of the invoice PDF
alter table user_settings
  add column if not exists bank_beneficiary     text,
  add column if not exists bank_name            text,
  add column if not exists bank_account_type    text,
  add column if not exists bank_account_number  text,
  add column if not exists bank_routing         text,
  add column if not exists bank_swift           text,
  add column if not exists bank_iban            text,
  add column if not exists bank_address         text,
  add column if not exists pix_key              text;
