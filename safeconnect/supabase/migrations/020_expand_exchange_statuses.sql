alter table public.exchanges
  drop constraint if exists exchanges_status_check;

alter table public.exchanges
  add constraint exchanges_status_check
  check (status in ('pending', 'assigned', 'in_transit', 'picked_up', 'completed', 'cancelled'));