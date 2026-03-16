alter table public.exchanges
  add column if not exists service_window_mode text check (service_window_mode in ('asap', 'scheduled')),
  add column if not exists requested_service_at timestamptz,
  add column if not exists quoted_distance_miles numeric(10,2),
  add column if not exists quoted_duration_minutes integer check (quoted_duration_minutes >= 0),
  add column if not exists quoted_base_rate_cents integer check (quoted_base_rate_cents >= 0),
  add column if not exists quoted_mileage_cents integer check (quoted_mileage_cents >= 0),
  add column if not exists quoted_after_hours_cents integer check (quoted_after_hours_cents >= 0),
  add column if not exists quoted_weekend_cents integer check (quoted_weekend_cents >= 0),
  add column if not exists quoted_high_risk_cents integer check (quoted_high_risk_cents >= 0),
  add column if not exists quoted_fuel_surcharge_cents integer check (quoted_fuel_surcharge_cents >= 0),
  add column if not exists quoted_service_fee_cents integer check (quoted_service_fee_cents >= 0),
  add column if not exists quoted_total_cents integer check (quoted_total_cents >= 0),
  add column if not exists quoted_is_after_hours boolean not null default false,
  add column if not exists quoted_is_weekend boolean not null default false,
  add column if not exists quoted_is_high_risk boolean not null default false,
  add column if not exists quoted_at timestamptz;

create index if not exists exchanges_requested_service_at_idx
  on public.exchanges (requested_service_at desc nulls last, created_at desc);

create index if not exists exchanges_quoted_total_cents_idx
  on public.exchanges (quoted_total_cents desc nulls last, created_at desc);

create index if not exists exchanges_quote_flags_idx
  on public.exchanges (quoted_is_after_hours, quoted_is_weekend, quoted_is_high_risk, created_at desc);
