create extension if not exists pgcrypto;

alter table public.exchanges
  add column if not exists service_type text not null default 'courier_service',
  add column if not exists cancellation_fee_cents integer not null default 4999,
  add column if not exists large_exchange_fee_cents integer not null default 7499,
  add column if not exists minimum_schedule_notice_minutes integer not null default 60,
  add column if not exists driver_arrived_at timestamptz,
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_by uuid references public.users(id),
  add column if not exists cancellation_reason text,
  add column if not exists cancellation_fee_applied boolean not null default false,
  add column if not exists cancellation_fee_reason text,
  add column if not exists waiting_window_minutes integer not null default 15,
  add column if not exists additional_wait_fee_cents integer not null default 0,
  add column if not exists client_directives text,
  add column if not exists pickup_directives text,
  add column if not exists dropoff_directives text,
  add column if not exists pets_secured_confirmed boolean not null default false,
  add column if not exists items_ready_at_door_confirmed boolean not null default false;

create table if not exists public.safeconnect_fee_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  display_name text not null,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  minimum_notice_minutes integer,
  waiting_window_minutes integer,
  applies_when text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.safeconnect_fee_rules (
  rule_key,
  display_name,
  amount_cents,
  currency,
  minimum_notice_minutes,
  waiting_window_minutes,
  applies_when,
  active
)
values
  (
    'standard_arrival_cancellation_fee',
    'Standard cancellation fee after courier arrival',
    4999,
    'USD',
    60,
    15,
    'Applies when courier has arrived or cancellation occurs inside the restricted cancellation window.',
    true
  ),
  (
    'large_exchange_scheduling_fee',
    'Large Exchange scheduling service fee',
    7499,
    'USD',
    120,
    15,
    'Applies to Large Exchange / two-person scheduled delivery requests requiring at least 2 hours advance notice.',
    true
  ),
  (
    'standard_waiting_window',
    'Standard included waiting window',
    0,
    'USD',
    null,
    15,
    'Client receives a standard 15-minute waiting window after courier arrival at pickup or drop-off.',
    true
  )
on conflict (rule_key) do update set
  display_name = excluded.display_name,
  amount_cents = excluded.amount_cents,
  currency = excluded.currency,
  minimum_notice_minutes = excluded.minimum_notice_minutes,
  waiting_window_minutes = excluded.waiting_window_minutes,
  applies_when = excluded.applies_when,
  active = excluded.active,
  updated_at = now();

alter table public.safeconnect_fee_rules enable row level security;

drop policy if exists "Admins can manage SafeConnect fee rules" on public.safeconnect_fee_rules;
create policy "Admins can manage SafeConnect fee rules"
on public.safeconnect_fee_rules
for all
to authenticated
using (public.is_safeconnect_admin())
with check (public.is_safeconnect_admin());

drop policy if exists "Authenticated users can view active SafeConnect fee rules" on public.safeconnect_fee_rules;
create policy "Authenticated users can view active SafeConnect fee rules"
on public.safeconnect_fee_rules
for select
to authenticated
using (active = true);

create or replace function public.apply_exchange_cancellation_policy(target_exchange_id uuid, canceling_user_id uuid, reason text default null)
returns public.exchanges
language plpgsql
security definer
set search_path = public
as $$
declare
  current_exchange public.exchanges%rowtype;
  should_charge boolean := false;
  charge_reason text := null;
begin
  select *
  into current_exchange
  from public.exchanges
  where id = target_exchange_id
  for update;

  if not found then
    raise exception 'Exchange not found';
  end if;

  if current_exchange.driver_arrived_at is not null then
    should_charge := true;
    charge_reason := 'Courier had already arrived. Standard cancellation fee applies.';
  elsif current_exchange.requested_service_at is not null
    and current_exchange.requested_service_at <= now() + interval '60 minutes' then
    should_charge := true;
    charge_reason := 'Cancellation occurred inside the 1-hour restricted cancellation window.';
  end if;

  update public.exchanges
  set
    status = 'canceled',
    canceled_at = now(),
    canceled_by = canceling_user_id,
    cancellation_reason = reason,
    cancellation_fee_applied = should_charge,
    cancellation_fee_reason = charge_reason,
    quoted_total_cents = coalesce(quoted_total_cents, 0) + case when should_charge then cancellation_fee_cents else 0 end
  where id = target_exchange_id
  returning * into current_exchange;

  return current_exchange;
end;
$$;

notify pgrst, 'reload schema';
