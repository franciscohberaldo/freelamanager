-- Weekly recurring invoices + availability holds

alter table automation_settings
  add column if not exists recurring_invoice_frequency text not null default 'monthly'
    check (recurring_invoice_frequency in ('monthly', 'weekly')),
  add column if not exists recurring_invoice_weekday int not null default 5
    check (recurring_invoice_weekday between 0 and 6),          -- 0=Sun ... 6=Sat (weekly mode)
  add column if not exists recurring_invoice_week_start int not null default 0
    check (recurring_invoice_week_start between 0 and 6),       -- first day of the billed week
  add column if not exists recurring_invoice_due_days int not null default 30
    check (recurring_invoice_due_days >= 0);                    -- net terms

-- Client holds on the freelancer's calendar (1st hold, 2nd hold, booked)
create table if not exists availability_holds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  uuid references clients(id) on delete set null,
  job_id     uuid references jobs(id) on delete set null,
  type       text not null default '1st_hold' check (type in ('1st_hold', '2nd_hold', 'booked')),
  start_date date not null,
  end_date   date not null,
  note       text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table availability_holds enable row level security;
create policy "Users manage own holds"
  on availability_holds for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists idx_availability_holds_user_dates on availability_holds(user_id, start_date, end_date);
