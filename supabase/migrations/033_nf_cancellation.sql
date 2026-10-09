-- Keep the cancelled note's number, series, issue date and amount for the audit trail.
alter table public.invoices drop constraint if exists invoices_nf_status_check;
alter table public.invoices add constraint invoices_nf_status_check
  check (nf_status in ('not_required','pending','requested','issued','sent','cancelled'));
alter table public.invoices add column if not exists nf_cancelled_at timestamptz;

create or replace function public.record_nf_cancellation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.nf_status = 'cancelled' and new.nf_status <> 'cancelled' then
    raise exception 'Uma NF cancelada deve permanecer no histórico';
  end if;
  if new.nf_status = 'cancelled' then
    if old.nf_status <> 'cancelled' and old.nf_status not in ('issued','sent') then
      raise exception 'Somente uma NF emitida pode ser marcada como cancelada';
    end if;
    new.nf_cancelled_at := coalesce(old.nf_cancelled_at, now());
    new.nf_number := old.nf_number;
    new.nf_series := old.nf_series;
    new.nf_issued_at := old.nf_issued_at;
    new.nf_amount_brl := old.nf_amount_brl;
  else
    new.nf_cancelled_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_record_nf_cancellation on public.invoices;
create trigger invoices_record_nf_cancellation before update on public.invoices
  for each row execute function public.record_nf_cancellation();
