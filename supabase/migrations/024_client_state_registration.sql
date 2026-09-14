-- The NF request e-mail states the tomador's inscrição estadual; most are exempt, but the
-- ones that are not have to be said out loud, so the client carries the number.
alter table clients
  add column if not exists state_registration text;
