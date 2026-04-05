-- User settings: company profile, invoice customization, preferences
create table if not exists user_settings (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  company_name  text,
  cnpj_cpf      text,
  logo_url      text,
  invoice_color text not null default '#1e40af',
  hour_rounding text not null default 'none',  -- none | 0.25 | 0.5 | 1
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy "Users manage own settings"
  on user_settings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger to auto-update updated_at
create or replace function update_user_settings_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_user_settings_updated_at();
