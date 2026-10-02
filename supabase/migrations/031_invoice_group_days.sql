-- An invoice can print its worked days as one line — the span, the summed hours or days,
-- the summed amount — instead of one line per day. The items stay stored day by day, so
-- each log is still linked to the invoice that billed it; only the page changes.
alter table invoices
  add column if not exists group_days boolean not null default false;
