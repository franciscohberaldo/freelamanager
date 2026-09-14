-- A third way to charge: a fixed price for the whole project, alongside by the hour and by
-- the day. The price lives in contract_value, which already exists; hours are still logged
-- for a fixed job, but they do not add up to money.

alter table jobs drop constraint if exists jobs_billing_mode_check;

alter table jobs add constraint jobs_billing_mode_check
  check (billing_mode in ('hourly', 'daily', 'fixed'));
