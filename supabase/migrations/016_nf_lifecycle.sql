-- NF lifecycle: fiscal data, invoice sequence, NF status and accountant requests

alter table user_settings
  add column if not exists legal_name                text,
  add column if not exists municipal_registration    text,
  add column if not exists fiscal_address            text,
  add column if not exists accountant_name           text,
  add column if not exists accountant_email          text,
  add column if not exists next_invoice_seq          int not null default 102,
  add column if not exists intermediary_bank_name    text,
  add column if not exists intermediary_bank_swift   text,
  add column if not exists intermediary_bank_aba     text,
  add column if not exists intermediary_bank_account text,
  add column if not exists intermediary_bank_address text;

alter table clients
  add column if not exists legal_name      text,
  add column if not exists cnpj            text,
  add column if not exists address         text,
  add column if not exists billing_entity  text,
  add column if not exists billing_address text,
  add column if not exists nf_rules        text;

alter table jobs
  add column if not exists end_client     text,
  add column if not exists intermediary   text,
  add column if not exists nf_description text,
  add column if not exists po_number      text;

alter table invoices
  add column if not exists seq_number      text,
  add column if not exists po_number       text,
  add column if not exists nf_status       text not null default 'pending'
    check (nf_status in ('not_required','pending','requested','issued','sent')),
  add column if not exists nf_series       text check (nf_series in ('paulinia','sao_paulo')),
  add column if not exists nf_number       text,
  add column if not exists nf_issued_at    date,
  add column if not exists nf_amount_brl   numeric(12,2),
  add column if not exists nf_requested_at timestamptz,
  add column if not exists nf_sent_at      timestamptz;

-- Existing foreign-currency invoices don't need an NF until paid
update invoices set nf_status = 'not_required' where currency <> 'BRL' and nf_status = 'pending';

create unique index if not exists idx_invoices_user_seq
  on invoices(user_id, seq_number) where seq_number is not null;
create unique index if not exists idx_invoices_user_nf
  on invoices(user_id, nf_series, nf_number) where nf_number is not null;

alter table invoice_items
  add column if not exists job_number text,
  add column if not exists is_manual  boolean not null default false;

create table if not exists nf_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  sent_to    text not null,
  reply_to   text,
  subject    text not null,
  body       text not null,
  resend_id  text,
  status     text not null default 'sent' check (status in ('sent','failed')),
  error      text,
  created_at timestamptz not null default now()
);
alter table nf_requests enable row level security;
create policy "Users manage own nf_requests" on nf_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_nf_requests_invoice on nf_requests(invoice_id);

-- Atomic next invoice sequence number (4 digits, continuous)
create or replace function get_next_invoice_seq(p_user_id uuid)
returns text as $$
declare v_next int;
begin
  insert into user_settings (user_id, next_invoice_seq) values (p_user_id, 103)
  on conflict (user_id) do update set next_invoice_seq = user_settings.next_invoice_seq + 1
  returning next_invoice_seq - 1 into v_next;
  return lpad(v_next::text, 4, '0');
end;
$$ language plpgsql security definer;
