-- Add vehicle type support to exchanges table
-- Migration: 015_vehicle_types.sql

-- Add vehicle_type column to exchanges table
alter table public.exchanges
add column vehicle_type text not null default 'standard'
check (vehicle_type in ('standard', 'premium', 'xl'));

-- Add vehicle type pricing columns to quote snapshot
alter table public.exchanges
add column quoted_vehicle_base_cents integer,
add column quoted_vehicle_type text;

-- Update RLS policies to allow vehicle_type updates
-- (existing policies should cover this since they're based on user_id)