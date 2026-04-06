-- Fase 7: Escala & Plataforma

-- API keys for REST access
create table if not exists api_keys (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  key_hash   text not null unique,   -- sha256 of the actual key
  key_prefix text not null,         -- first 8 chars shown in UI
  is_active  boolean not null default true,
  last_used  timestamptz,
  created_at timestamptz default now()
);

alter table api_keys enable row level security;
create policy "users own api keys" on api_keys
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Outgoing webhooks
create table if not exists webhooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  url        text not null,
  events     text[] not null default '{}',
  secret     text not null default gen_random_uuid()::text,
  is_active  boolean not null default true,
  last_fired timestamptz,
  created_at timestamptz default now()
);

alter table webhooks enable row level security;
create policy "users own webhooks" on webhooks
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Payment links
create table if not exists payment_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  provider   text not null check (provider in ('stripe','mercadopago')),
  link_url   text not null,
  status     text not null default 'pending' check (status in ('pending','paid','expired')),
  created_at timestamptz default now()
);

alter table payment_links enable row level security;
create policy "users own payment links" on payment_links
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Webhook log
create table if not exists webhook_deliveries (
  id          uuid primary key default gen_random_uuid(),
  webhook_id  uuid not null references webhooks(id) on delete cascade,
  event       text not null,
  payload     jsonb not null,
  status_code int,
  response    text,
  fired_at    timestamptz default now()
);

alter table webhook_deliveries enable row level security;
create policy "users own webhook deliveries" on webhook_deliveries
  using ((select user_id from webhooks where id = webhook_id) = auth.uid());
