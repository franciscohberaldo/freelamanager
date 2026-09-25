-- A job's start and end dates follow its diárias: adding a day before the start or after
-- the end moves that edge out to it, and removing the day that sat on an edge pulls the
-- edge in to the nearest remaining day. A period set by hand that is wider than the days
-- logged so far (a job still under way) is left alone.

create or replace function sync_job_dates_from_day(p_job_id uuid, p_removed date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_day date;
  last_day  date;
begin
  select min(date), max(date) into first_day, last_day from daily_logs where job_id = p_job_id;
  if first_day is null then return; end if;

  update jobs set
    start_date = case
      when start_date is null or first_day < start_date then first_day
      when p_removed is not null and p_removed = start_date then first_day
      else start_date end,
    end_date = case
      when end_date is null or last_day > end_date then last_day
      when p_removed is not null and p_removed = end_date then last_day
      else end_date end
  where id = p_job_id;
end;
$$;

create or replace function daily_logs_sync_job_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    -- The old row's job lost (or moved) a day; for an update within the same job the
    -- old date only matters if it was an edge.
    perform sync_job_dates_from_day(old.job_id, old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform sync_job_dates_from_day(new.job_id, null);
  end if;
  return null;
end;
$$;

drop trigger if exists daily_logs_sync_job_dates on daily_logs;
create trigger daily_logs_sync_job_dates
  after insert or update of date, job_id or delete on daily_logs
  for each row execute function daily_logs_sync_job_dates();

-- Existing jobs: stretch their dates over the days already logged.
update jobs j set
  start_date = case when j.start_date is null or d.first_day < j.start_date then d.first_day else j.start_date end,
  end_date   = case when j.end_date   is null or d.last_day  > j.end_date   then d.last_day  else j.end_date   end
from (select job_id, min(date) as first_day, max(date) as last_day from daily_logs group by job_id) d
where d.job_id = j.id;
