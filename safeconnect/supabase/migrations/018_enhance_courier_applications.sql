-- Enhance courier_applications table with location and vehicle type fields
-- Used during onboarding, then transferred to couriers table on approval

alter table public.courier_applications
add column vehicle_type text check (vehicle_type in ('car', 'truck', 'van', 'motorcycle', 'bicycle')),
add column service_radius_miles integer default 25,
add column willing_to_commute_miles integer default 50,
add column latitude numeric(9,6),
add column longitude numeric(9,6);

-- Add index on vehicle_type for faster filtering
create index if not exists courier_applications_vehicle_type_idx on public.courier_applications(vehicle_type);
