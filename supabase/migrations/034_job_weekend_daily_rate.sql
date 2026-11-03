-- Optional different day rate for weekends (Saturday/Sunday) on daily-billed jobs.
-- NULL means weekends are charged at the job's normal daily_rate.
alter table jobs add column weekend_daily_rate numeric;
