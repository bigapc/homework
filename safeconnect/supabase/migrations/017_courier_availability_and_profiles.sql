-- Courier availability and location-based matching system
-- Supports real-time courier availability, location tracking, and dispatcher matching

-- Create couriers table (approved courier profiles)
create table public.couriers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  application_id uuid references public.courier_applications(id) on delete set null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  vehicle_type text not null check (vehicle_type in ('car', 'truck', 'van', 'motorcycle', 'bicycle')),
  vehicle_description text,
  profile_bio text,
  -- Location and service area
  latitude numeric(9,6),
  longitude numeric(9,6),
  service_radius_miles integer not null default 25,
  willing_to_commute_miles integer not null default 50,
  -- Status and activity
  status text not null default 'offline' check (status in ('online', 'offline', 'on_delivery')),
  rating numeric(3,2),
  total_deliveries integer not null default 0,
  -- Timestamps
  profile_created_at timestamptz not null default now(),
  last_location_update_at timestamptz,
  last_online_at timestamptz,
  last_offline_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Create courier_locations for real-time location history
create table public.courier_locations (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers(id) on delete cascade,
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  accuracy_meters integer,
  exchange_id uuid references public.exchanges(id) on delete set null,
  recorded_at timestamptz not null default now()
);

-- Create courier_ratings table (from completed deliveries)
create table public.courier_ratings (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.couriers(id) on delete cascade,
  exchange_id uuid not null references public.exchanges(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.couriers enable row level security;
alter table public.courier_locations enable row level security;
alter table public.courier_ratings enable row level security;

-- Courier RLS policies
create policy "couriers: public select approved" on public.couriers
  for select
  to anon, authenticated
  using (true);

create policy "couriers: courier select own" on public.couriers
  for select
  using (auth.uid() = user_id);

create policy "couriers: courier update own" on public.couriers
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "couriers: admin select all" on public.couriers
  for select
  using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "couriers: admin update all" on public.couriers
  for update
  using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

-- Courier locations RLS
create policy "courier_locations: courier insert own" on public.courier_locations
  for insert
  with check (
    auth.uid() = (select user_id from public.couriers where id = courier_id)
  );

create policy "courier_locations: courier select own" on public.courier_locations
  for select
  using (
    auth.uid() = (select user_id from public.couriers where id = courier_id)
  );

create policy "courier_locations: dispatcher select for assignment" on public.courier_locations
  for select
  using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

-- Courier ratings RLS
create policy "courier_ratings: public select" on public.courier_ratings
  for select using (true);

create policy "courier_ratings: user insert own" on public.courier_ratings
  for insert
  with check (auth.uid() = user_id);

-- Indexes for performance
create index couriers_user_id_idx on public.couriers(user_id);
create index couriers_status_idx on public.couriers(status);
create index couriers_vehicle_type_idx on public.couriers(vehicle_type);
create index couriers_location_idx on public.couriers(latitude, longitude);
create index couriers_last_location_update_idx on public.couriers(last_location_update_at desc);

create index courier_locations_courier_id_idx on public.courier_locations(courier_id);
create index courier_locations_recorded_at_idx on public.courier_locations(recorded_at desc);
create index courier_locations_courier_recorded_idx on public.courier_locations(courier_id, recorded_at desc);

create index courier_ratings_courier_id_idx on public.courier_ratings(courier_id);
create index courier_ratings_exchange_id_idx on public.courier_ratings(exchange_id);

-- Add courier_id to exchanges table (already exists, but ensure it's set)
-- alter table public.exchanges add column if not exists courier_id uuid references public.users(id) on delete set null;
-- This should already exist from earlier migrations

-- Function to calculate courier rating
create or replace function get_courier_rating(courier_id uuid)
returns numeric as $$
  select coalesce(avg(rating), 0)::numeric(3,2)
  from public.courier_ratings
  where courier_id = $1;
$$ language sql stable;

-- Function to find nearby available couriers
create or replace function find_nearby_couriers(
  pickup_lat numeric,
  pickup_lng numeric,
  vehicle_type text default null,
  max_distance_miles numeric default 25
)
returns table(
  courier_id uuid,
  user_id uuid,
  first_name text,
  last_name text,
  phone text,
  vehicle_type text,
  rating numeric,
  total_deliveries integer,
  distance_miles numeric,
  status text
) as $$
  select
    c.id,
    c.user_id,
    c.first_name,
    c.last_name,
    c.phone,
    c.vehicle_type,
    c.rating,
    c.total_deliveries,
    (
      6371 * 2 * asin(sqrt(
        sin(radians((pickup_lat - c.latitude) / 2))^2 +
        cos(radians(c.latitude)) * cos(radians(pickup_lat)) *
        sin(radians((pickup_lng - c.longitude) / 2))^2
      ))
    ) * 0.621371 as distance_miles,
    c.status
  from public.couriers c
  where c.status = 'online'
    and c.latitude is not null
    and c.longitude is not null
    and (vehicle_type is null or c.vehicle_type = vehicle_type)
    and (
      6371 * 2 * asin(sqrt(
        sin(radians((pickup_lat - c.latitude) / 2))^2 +
        cos(radians(c.latitude)) * cos(radians(pickup_lat)) *
        sin(radians((pickup_lng - c.longitude) / 2))^2
      ))
    ) * 0.621371 <= max_distance_miles
  order by distance_miles asc;
$$ language sql stable;
