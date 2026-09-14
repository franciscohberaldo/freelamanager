-- Invoice lines can now be priced per project, alongside per hour and per day.
-- A project line is quantity 1 at the closed price, whatever hours went into it.

alter table invoice_items drop constraint if exists invoice_items_unit_check;

alter table invoice_items add constraint invoice_items_unit_check
  check (unit is null or unit in ('hour', 'day', 'project'));
