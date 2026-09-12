-- Job timezone / working hours, confidentiality flag, FX details on international payments

alter table jobs
  add column if not exists timezone        text,                         -- IANA, e.g. America/Los_Angeles
  add column if not exists work_hours      text,                         -- e.g. 09:00-18:00 (in the job's timezone)
  add column if not exists is_confidential boolean not null default false;

alter table invoice_payments
  drop constraint if exists invoice_payments_method_check;
alter table invoice_payments
  add constraint invoice_payments_method_check
    check (method in ('pix', 'ted', 'cartao', 'boleto', 'wire', 'outro'));

alter table invoice_payments
  add column if not exists exchange_rate       numeric(12,6),   -- BRL per 1 unit of invoice currency
  add column if not exists amount_received_brl numeric(12,2),   -- net amount credited in BRL
  add column if not exists fees                numeric(12,2);   -- bank/FX fees in invoice currency
