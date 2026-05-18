create index if not exists idx_exchanges_status_created_at
on public.exchanges(status, created_at desc);

create index if not exists idx_exchanges_payment_status
on public.exchanges(payment_status);

create index if not exists idx_exchanges_proof_status
on public.exchanges(proof_status);

create index if not exists idx_tracking_request_updated
on public.tracking(request_id, updated_at desc);

create index if not exists idx_exchange_service_proofs_exchange_type
on public.exchange_service_proofs(exchange_id, proof_type);

create or replace view public.safeconnect_exchange_operations_summary
with (security_invoker = true)
as
select
  e.id,
  upper(left(e.id::text, 8)) as request_code,
  e.status,
  e.payment_status,
  e.payment_required,
  e.proof_status,
  e.service_type,
  survivor.email as survivor_email,
  courier.email as courier_email,
  e.pickup,
  e.dropoff,
  e.items,
  e.quoted_total_cents,
  round(coalesce(e.quoted_total_cents, 0)::numeric / 100, 2) as quoted_total_usd,
  e.quoted_currency,
  e.cancellation_fee_cents,
  e.large_exchange_fee_cents,
  e.waiting_window_minutes,
  e.pickup_arrived_at,
  e.pickup_completed_at,
  e.dropoff_arrived_at,
  e.dropoff_completed_at,
  e.created_at,
  e.paid_at,
  coalesce(proof_summary.proof_count, 0) as proof_count,
  coalesce(proof_summary.required_proof_count, 0) as required_proof_count,
  case
    when coalesce(proof_summary.required_proof_count, 0) >= 4 then true
    else false
  end as proof_package_complete,
  proof_summary.missing_required_proofs,
  latest_tracking.status as latest_tracking_status,
  latest_tracking.route_lat as latest_route_lat,
  latest_tracking.route_lng as latest_route_lng,
  latest_tracking.updated_at as latest_tracking_at
from public.exchanges e
left join public.users survivor on survivor.id = e.user_id
left join public.users courier on courier.id = e.courier_id
left join lateral (
  select
    count(*) as proof_count,
    count(*) filter (
      where proof_type in (
        'pickup_photo',
        'pickup_signature',
        'dropoff_photo',
        'dropoff_signature'
      )
    ) as required_proof_count,
    array_remove(array[
      case when not exists (
        select 1 from public.exchange_service_proofs p
        where p.exchange_id = e.id and p.proof_type = 'pickup_photo'
      ) then 'pickup_photo' end,
      case when not exists (
        select 1 from public.exchange_service_proofs p
        where p.exchange_id = e.id and p.proof_type = 'pickup_signature'
      ) then 'pickup_signature' end,
      case when not exists (
        select 1 from public.exchange_service_proofs p
        where p.exchange_id = e.id and p.proof_type = 'dropoff_photo'
      ) then 'dropoff_photo' end,
      case when not exists (
        select 1 from public.exchange_service_proofs p
        where p.exchange_id = e.id and p.proof_type = 'dropoff_signature'
      ) then 'dropoff_signature' end
    ], null) as missing_required_proofs
  from public.exchange_service_proofs p
  where p.exchange_id = e.id
) proof_summary on true
left join lateral (
  select
    t.status,
    t.route_lat,
    t.route_lng,
    t.updated_at
  from public.tracking t
  where t.request_id = e.id
  order by t.updated_at desc
  limit 1
) latest_tracking on true;

notify pgrst, 'reload schema';
