create table if not exists user_availability (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'disponivel'
                     check (status in ('disponivel', 'parcialmente', 'ocupado', 'indisponivel')),
  available_from   date,
  hours_per_week   int,
  working_days     text[] not null default array['seg','ter','qua','qui','sex'],
  message          text,
  accepting_projects boolean not null default true,
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

alter table user_availability enable row level security;

create policy "Users manage own availability"
  on user_availability for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
