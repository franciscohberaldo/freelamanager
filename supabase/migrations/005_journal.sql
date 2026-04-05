create table if not exists daily_journal (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  content    text,
  mood       text check (mood in ('great','good','okay','bad','terrible')),
  highlights text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table daily_journal enable row level security;

create policy "Users manage own journal"
  on daily_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger daily_journal_updated_at
  before update on daily_journal for each row execute function update_updated_at_column();

create index idx_daily_journal_user_date on daily_journal(user_id, date desc);
