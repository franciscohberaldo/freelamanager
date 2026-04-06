-- ===================================================
-- Fase 4: Automação & Comunicação
-- ===================================================

-- 1. Configurações de automação por usuário
create table if not exists automation_settings (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  -- Billing reminders
  billing_reminder_enabled boolean not null default false,
  billing_reminder_days    int     not null default 3,  -- days after due_date
  -- Weekly summary email
  weekly_summary_enabled   boolean not null default false,
  weekly_summary_day       int     not null default 1,  -- 0=Sun,1=Mon,...,6=Sat
  -- Recurring invoice
  recurring_invoice_enabled boolean not null default false,
  recurring_invoice_job_id  uuid references jobs(id) on delete set null,
  recurring_invoice_day     int    not null default 1,  -- day of month to generate
  updated_at               timestamptz not null default now()
);

alter table automation_settings enable row level security;
create policy "Users manage own automation settings"
  on automation_settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Recurring agenda events
alter table agenda_events
  add column if not exists recurrence text check (recurrence in ('none','daily','weekly','biweekly','monthly')) default 'none',
  add column if not exists recurrence_end date;

-- 3. Automation log (track what was sent/done)
create table if not exists automation_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,   -- billing_reminder | weekly_summary | recurring_invoice
  payload    jsonb,
  status     text not null default 'ok',  -- ok | error
  error_msg  text,
  created_at timestamptz not null default now()
);

alter table automation_log enable row level security;
create policy "Users view own automation log"
  on automation_log for select
  using (auth.uid() = user_id);

-- trigger for updated_at
create trigger automation_settings_updated_at
  before update on automation_settings
  for each row execute function touch_updated_at();
