create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  client_id   uuid references clients(id) on delete set null,
  name        text not null,
  description text,
  status      text not null default 'active'
              check (status in ('planning','active','on_hold','completed','cancelled')),
  color       text not null default '#7c3aed',
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'todo'
              check (status in ('todo','in_progress','done','blocked')),
  progress    int  not null default 0 check (progress >= 0 and progress <= 100),
  start_date  date,
  end_date    date,
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table projects      enable row level security;
alter table project_tasks enable row level security;

create policy "Users manage own projects"
  on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own project tasks"
  on project_tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger projects_updated_at
  before update on projects for each row execute function update_updated_at_column();

create trigger project_tasks_updated_at
  before update on project_tasks for each row execute function update_updated_at_column();

create index idx_projects_user      on projects(user_id);
create index idx_project_tasks_proj on project_tasks(project_id);
