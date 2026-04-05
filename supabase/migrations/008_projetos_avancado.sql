-- ===================================================
-- Fase 3: Projetos Avançados
-- ===================================================

-- 1. Subtarefas / checklist por task
create table if not exists project_task_items (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references project_tasks(id) on delete cascade,
  text     text not null,
  is_done  boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table project_task_items enable row level security;

-- Inherit access from project_tasks (user owns the project)
create policy "Users manage own task items"
  on project_task_items for all
  using (
    exists (
      select 1 from project_tasks pt
      join projects p on p.id = pt.project_id
      where pt.id = project_task_items.task_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from project_tasks pt
      join projects p on p.id = pt.project_id
      where pt.id = project_task_items.task_id
        and p.user_id = auth.uid()
    )
  );

-- 2. Templates de projeto
create table if not exists project_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  tasks      jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table project_templates enable row level security;

create policy "Users manage own templates"
  on project_templates for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Folgas e férias
create table if not exists time_off (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null,
  type       text not null check (type in ('ferias','feriado','folga','doenca','outro')),
  note       text,
  created_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table time_off enable row level security;

create policy "Users manage own time off"
  on time_off for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_time_off_user_date on time_off(user_id, date);
