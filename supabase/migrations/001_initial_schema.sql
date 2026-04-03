-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTS
-- ============================================================
create table clients (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  company     text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CLIENT CONTACTS
-- ============================================================
create table client_contacts (
  id          uuid primary key default uuid_generate_v4(),
  client_id   uuid not null references clients(id) on delete cascade,
  name        text not null,
  role        text,
  email       text,
  phone       text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- JOBS
-- ============================================================
create table jobs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete restrict,
  name            text not null,
  description     text,
  hourly_rate     numeric(12,2) not null default 0,
  daily_rate      numeric(12,2) not null default 0,
  currency        text not null default 'BRL' check (currency in ('BRL','USD','EUR')),
  status          text not null default 'active' check (status in ('proposal','active','paused','completed')),
  contract_value  numeric(12,2),
  start_date      date,
  end_date        date,
  is_recurring    boolean not null default false,
  tax_rate        numeric(5,2) not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- DAILY LOGS
-- ============================================================
create table daily_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  job_id        uuid not null references jobs(id) on delete cascade,
  date          date not null,
  meetings      text,
  requests      text,
  daily_rate    numeric(12,2) not null default 0,
  hours_worked  numeric(5,2) not null default 0,
  hours_billed  numeric(5,2) not null default 0,
  total_value   numeric(12,2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- INVOICE SEQUENCE (per user per year)
-- ============================================================
create table invoice_sequences (
  id       uuid primary key default uuid_generate_v4(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  year     int not null,
  last_seq int not null default 0,
  unique (user_id, year)
);

-- ============================================================
-- INVOICES
-- ============================================================
create table invoices (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  job_id              uuid not null references jobs(id) on delete restrict,
  invoice_number      text not null,
  period_start        date not null,
  period_end          date not null,
  total_hours_billed  numeric(8,2) not null default 0,
  subtotal            numeric(12,2) not null default 0,
  tax_rate            numeric(5,2) not null default 0,
  tax_amount          numeric(12,2) not null default 0,
  total               numeric(12,2) not null default 0,
  currency            text not null default 'BRL' check (currency in ('BRL','USD','EUR')),
  status              text not null default 'draft' check (status in ('draft','sent','paid','overdue')),
  sent_at             timestamptz,
  paid_at             timestamptz,
  due_date            date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- INVOICE ITEMS
-- ============================================================
create table invoice_items (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references invoices(id) on delete cascade,
  log_id       uuid references daily_logs(id) on delete set null,
  date         date not null,
  description  text,
  hours_billed numeric(5,2) not null default 0,
  rate         numeric(12,2) not null default 0,
  subtotal     numeric(12,2) not null default 0
);

-- ============================================================
-- AGENDA EVENTS
-- ============================================================
create table agenda_events (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid references jobs(id) on delete cascade,
  title       text not null,
  description text,
  type        text not null check (type in ('payment','delivery','meeting','milestone','deadline')),
  event_date  date not null,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients
  for each row execute function update_updated_at_column();

create trigger jobs_updated_at before update on jobs
  for each row execute function update_updated_at_column();

create trigger daily_logs_updated_at before update on daily_logs
  for each row execute function update_updated_at_column();

create trigger invoices_updated_at before update on invoices
  for each row execute function update_updated_at_column();

create trigger agenda_events_updated_at before update on agenda_events
  for each row execute function update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table clients enable row level security;
alter table client_contacts enable row level security;
alter table jobs enable row level security;
alter table daily_logs enable row level security;
alter table invoice_sequences enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table agenda_events enable row level security;

-- Clients
create policy "users own clients" on clients
  for all using (auth.uid() = user_id);

-- Client contacts (via client ownership)
create policy "users own client_contacts" on client_contacts
  for all using (
    exists (select 1 from clients where id = client_contacts.client_id and user_id = auth.uid())
  );

-- Jobs
create policy "users own jobs" on jobs
  for all using (auth.uid() = user_id);

-- Daily logs
create policy "users own daily_logs" on daily_logs
  for all using (auth.uid() = user_id);

-- Invoice sequences
create policy "users own invoice_sequences" on invoice_sequences
  for all using (auth.uid() = user_id);

-- Invoices
create policy "users own invoices" on invoices
  for all using (auth.uid() = user_id);

-- Invoice items (via invoice ownership)
create policy "users own invoice_items" on invoice_items
  for all using (
    exists (select 1 from invoices where id = invoice_items.invoice_id and user_id = auth.uid())
  );

-- Agenda events
create policy "users own agenda_events" on agenda_events
  for all using (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: get next invoice number
-- ============================================================
create or replace function get_next_invoice_number(p_user_id uuid, p_year int)
returns text as $$
declare
  v_seq int;
begin
  insert into invoice_sequences (user_id, year, last_seq)
  values (p_user_id, p_year, 1)
  on conflict (user_id, year)
  do update set last_seq = invoice_sequences.last_seq + 1
  returning last_seq into v_seq;

  return p_year || '-' || lpad(v_seq::text, 3, '0');
end;
$$ language plpgsql security definer;

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_jobs_user_id on jobs(user_id);
create index idx_jobs_client_id on jobs(client_id);
create index idx_daily_logs_user_id on daily_logs(user_id);
create index idx_daily_logs_job_id on daily_logs(job_id);
create index idx_daily_logs_date on daily_logs(date);
create index idx_invoices_user_id on invoices(user_id);
create index idx_invoices_job_id on invoices(job_id);
create index idx_agenda_events_user_id on agenda_events(user_id);
create index idx_agenda_events_event_date on agenda_events(event_date);
