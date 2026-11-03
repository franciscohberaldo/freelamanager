-- Optional different day rate for holidays on daily-billed jobs. Takes precedence over
-- the weekend and normal rates. NULL means holidays use the weekend/normal rate.
alter table jobs add column holiday_daily_rate numeric;
