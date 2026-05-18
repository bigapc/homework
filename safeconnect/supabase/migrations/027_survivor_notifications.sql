create or replace function public.create_survivor_exchange_status_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  survivor_email text;
  template_name text;
  priority_name text := 'normal';
  sound_name text := 'standard_request';
begin
  if old.status is not distinct from new.status
    and old.payment_status is not distinct from new.payment_status
    and old.courier_id is not distinct from new.courier_id then
    return new;
  end if;

  select email into survivor_email
  from public.users
  where id = new.user_id;

  if survivor_email is null then
    return new;
  end if;

  if old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    template_name := 'survivor_payment_confirmed';
  elsif old.courier_id is distinct from new.courier_id and new.courier_id is not null then
    template_name := 'survivor_courier_assigned';
  elsif old.status is distinct from new.status and new.status = 'in_transit' then
    template_name := 'survivor_courier_enroute';
  elsif old.status is distinct from new.status and new.status = 'completed' then
    template_name := 'survivor_delivery_completed';
    priority_name := 'high';
    sound_name := 'delivery_complete';
  elsif old.status is distinct from new.status and new.status = 'canceled' then
    template_name := 'survivor_request_canceled';
    priority_name := 'high';
    sound_name := 'request_canceled';
  else
    return new;
  end if;

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
  ) values (
    new.user_id,
    new.id,
    'in_app',
    survivor_email,
    template_name,
    jsonb_build_object(
      'exchangeId', new.id,
      'requestCode', upper(left(new.id::text, 8)),
      'status', new.status,
      'paymentStatus', new.payment_status,
      'pickup', new.pickup,
      'dropoff', new.dropoff,
      'updatedAt', now()
    ),
    'queued',
    priority_name,
    sound_name
  );

  return new;
end;
$$;

drop trigger if exists create_survivor_exchange_status_alert on public.exchanges;
create trigger create_survivor_exchange_status_alert
after update on public.exchanges
for each row execute function public.create_survivor_exchange_status_alert();

create or replace function public.create_survivor_tracking_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  survivor_id uuid;
  survivor_email text;
  request_pickup text;
  request_dropoff text;
  template_name text;
begin
  select e.user_id, e.pickup, e.dropoff, u.email
  into survivor_id, request_pickup, request_dropoff, survivor_email
  from public.exchanges e
  left join public.users u on u.id = e.user_id
  where e.id = new.request_id;

  if survivor_id is null then
    return new;
  end if;

  if new.status = 'delivered' then
    template_name := 'survivor_tracking_delivered';
  else
    template_name := 'survivor_tracking_update';
  end if;

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
  ) values (
    survivor_id,
    new.request_id,
    'in_app',
    survivor_email,
    template_name,
    jsonb_build_object(
      'exchangeId', new.request_id,
      'requestCode', upper(left(new.request_id::text, 8)),
      'trackingStatus', new.status,
      'pickup', request_pickup,
      'dropoff', request_dropoff,
      'routeLat', new.route_lat,
      'routeLng', new.route_lng,
      'updatedAt', new.updated_at
    ),
    'queued',
    case when new.status = 'delivered' then 'high' else 'normal' end,
    case when new.status = 'delivered' then 'delivery_complete' else 'tracking_update' end
  );

  return new;
end;
$$;

drop trigger if exists create_survivor_tracking_alert on public.tracking;
create trigger create_survivor_tracking_alert
after insert on public.tracking
for each row execute function public.create_survivor_tracking_alert();

notify pgrst, 'reload schema';
