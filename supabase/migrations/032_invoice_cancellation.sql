-- Cancelled invoices stay in history; cancellation does not erase payments or items.
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled'));
alter table public.invoices add column if not exists cancelled_at timestamptz;

create or replace function public.record_invoice_cancellation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Uma invoice cancelada não pode ser reativada';
  end if;
  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(old.cancelled_at, now());
  else
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists invoices_record_cancellation on public.invoices;
create trigger invoices_record_cancellation before update on public.invoices
  for each row execute function public.record_invoice_cancellation();

-- Locking the invoice serializes a payment with a concurrent cancellation.
create or replace function public.reject_cancelled_invoice_payment()
returns trigger language plpgsql set search_path = public as $$
declare invoice_status text;
begin
  select status into invoice_status from public.invoices
    where id = new.invoice_id for update;
  if invoice_status = 'cancelled' then
    raise exception 'Não é possível registrar pagamento em uma invoice cancelada';
  end if;
  return new;
end;
$$;
drop trigger if exists invoice_payments_check_cancellation on public.invoice_payments;
create trigger invoice_payments_check_cancellation before insert on public.invoice_payments
  for each row execute function public.reject_cancelled_invoice_payment();
