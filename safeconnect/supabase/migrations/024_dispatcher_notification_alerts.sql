alter table public.notification_events
  drop constraint if exists notification_events_channel_check;

alter table public.notification_events
  add constraint notification_events_channel_check
  check (channel in ('in_app', 'sms', 'email', 'push'));

alter table public.notification_events
  drop constraint if exists notification_events_status_check;

alter table public.notification_events
  add constraint notification_events_status_check
  check (status in ('queued', 'pending', 'sent', 'failed'));

alter table public.notification_events
  alter column recipient drop not null;

alter table public.notification_events
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.users(id),
  add column if not exists priority text not null default 'normal',
  add column if not exists sound_key text not null default 'standard_request';

create or replace function public.create_new_exchange_dispatch_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_events (
    user_id,
    exchange_id,
    channel,
    recipient,
    template,
    payload,
    status,
    priority,
    sound_key
  )
  select
    u.id,
    new.id,
    'in_app',
    u.email,
    case
      when coalesce(new.vehicle_type, 'standard') in ('xl', 'large', 'premium') then 'large_exchange_request'
      else 'new_exchange_request'
    end,
    jsonb_build_object(
      'exchangeId', new.id,
      'pickup', new.pickup,
      'dropoff', new.dropoff,
      'status', new.status,
      'vehicleType', coalesce(new.vehicle_type, 'standard'),
      'createdAt', new.created_at
    ),
    'queued',
    case
      when coalesce(new.vehicle_type, 'standard') in ('xl', 'large', 'premium') then 'high'
      else 'normal'
    end,
    case
      when coalesce(new.vehicle_type, 'standard') in ('xl', 'large', 'premium') then 'large_exchange'
      else 'standard_request'
    end
  from public.users u
  where u.role = 'admin';

  return new;
end;
$$;

drop trigger if exists create_new_exchange_dispatch_alert on public.exchanges;

create trigger create_new_exchange_dispatch_alert
after insert on public.exchanges
for each row execute function public.create_new_exchange_dispatch_alert();

alter table public.notification_events enable row level security;

drop policy if exists "Admins can manage notification events" on public.notification_events;
create policy "Admins can manage notification events"
on public.notification_events
for all
to authenticated
using (public.is_safeconnect_admin())
with check (public.is_safeconnect_admin());

drop policy if exists "Users can view own notification events" on public.notification_events;
create policy "Users can view own notification events"
on public.notification_events
for select
to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_events'
  ) then
    alter publication supabase_realtime add table public.notification_events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'exchanges'
  ) then
    alter publication supabase_realtime add table public.exchanges;
  end if;
end $$;

notify pgrst, 'reload schema';
