-- ===================================================
-- Fase 2: Financeiro Completo
-- ===================================================

-- 1. Despesas
create table if not exists expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  category    text not null check (category in ('software','hardware','curso','imposto','servico','outro')),
  description text not null,
  amount      numeric(12,2) not null check (amount > 0),
  date        date not null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table expenses enable row level security;
create policy "Users manage own expenses"
  on expenses for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_expenses_user_date on expenses(user_id, date desc);

-- 2. Pagamentos parciais de invoice
create table if not exists invoice_payments (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  paid_at    date not null,
  method     text check (method in ('pix','ted','cartao','boleto','outro')),
  notes      text,
  created_at timestamptz not null default now()
);

alter table invoice_payments enable row level security;
create policy "Users manage own invoice payments"
  on invoice_payments for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Metas mensais de horas e receita
create table if not exists user_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null check (type in ('hours_month','revenue_month')),
  target     numeric(12,2) not null check (target > 0),
  period     text not null,    -- ex: '2025-04'
  created_at timestamptz not null default now(),
  unique(user_id, type, period)
);

alter table user_goals enable row level security;
create policy "Users manage own goals"
  on user_goals for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at triggers
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger expenses_updated_at
  before update on expenses
  for each row execute function touch_updated_at();
