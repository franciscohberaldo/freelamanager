-- Add task management fields to agenda_events
alter table agenda_events
  add column if not exists task_status text not null default 'working_on_it'
    check (task_status in ('working_on_it', 'done', 'stuck', 'todo')),
  add column if not exists priority text
    check (priority in ('low', 'medium', 'high')),
  add column if not exists budget numeric(12,2),
  add column if not exists start_date date,
  add column if not exists files_count int not null default 0;

-- Migrate existing is_done to task_status
update agenda_events set task_status = 'done' where is_done = true;
