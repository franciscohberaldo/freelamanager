-- Fase 6: CRM & Relacionamento com Cliente

-- Score (1-5) on existing clients table
alter table clients add column if not exists score int check (score >= 1 and score <= 5);

-- Sales pipeline deals
create table if not exists sales_pipeline (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  client_id        uuid references clients(id) on delete set null,
  stage            text not null default 'lead'
                   check (stage in ('lead','contacted','proposal','negotiation','won','lost')),
  title            text not null,
  value            numeric(12,2),
  expected_close   date,
  notes            text,
  position         int  not null default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table sales_pipeline enable row level security;
create policy "users own pipeline" on sales_pipeline
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Client interaction history
create table if not exists client_interactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  client_id    uuid not null references clients(id) on delete cascade,
  type         text not null check (type in ('email','call','meeting','note','proposal')),
  summary      text not null,
  happened_at  timestamptz not null default now(),
  created_at   timestamptz default now()
);

alter table client_interactions enable row level security;
create policy "users own interactions" on client_interactions
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public portal tokens (one per client)
create table if not exists client_portal_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  token      text unique not null default gen_random_uuid()::text,
  created_at timestamptz default now(),
  unique (client_id)
);

alter table client_portal_tokens enable row level security;
create policy "users own portal tokens" on client_portal_tokens
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Public read so portal page can validate the token
create policy "public read portal tokens" on client_portal_tokens
  for select using (true);

-- touch updated_at for pipeline
create trigger touch_sales_pipeline
  before update on sales_pipeline
  for each row execute function touch_updated_at();
