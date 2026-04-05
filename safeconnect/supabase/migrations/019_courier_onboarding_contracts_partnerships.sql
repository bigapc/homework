-- Courier onboarding, contracted assignments, and partnership operations foundations

create table if not exists public.courier_onboarding (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references public.users(id) on delete cascade,
  identity_verified boolean not null default false,
  background_check_passed boolean not null default false,
  training_completed boolean not null default false,
  agreement_signed boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(courier_id)
);

alter table public.courier_onboarding enable row level security;

create policy "courier_onboarding: courier select own" on public.courier_onboarding
  for select
  using (auth.uid() = courier_id);

create policy "courier_onboarding: admin select all" on public.courier_onboarding
  for select
  using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "courier_onboarding: admin update all" on public.courier_onboarding
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

alter table public.courier_applications
  add column if not exists user_id uuid references public.users(id) on delete set null,
  add column if not exists background_check_consent boolean not null default false,
  add column if not exists notes text,
  add column if not exists approved_at timestamptz;

create table if not exists public.exchange_courier_contracts (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges(id) on delete cascade,
  courier_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'primary' check (role in ('primary', 'support', 'reserve', 'rental_pickup')),
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'in_transit', 'completed', 'cancelled')),
  vehicle_required text,
  pickup_location text,
  dropoff_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exchange_courier_contracts enable row level security;

create policy "exchange_courier_contracts: admin all" on public.exchange_courier_contracts
  for all
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

create policy "exchange_courier_contracts: courier select own" on public.exchange_courier_contracts
  for select
  using (auth.uid() = courier_id);

create table if not exists public.partner_services (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null,
  partner_type text not null check (partner_type in ('legal_aid', 'probation_office', 'courthouse', 'government_agency', 'attorney', 'directory', 'other')),
  integration_mode text not null default 'portal' check (integration_mode in ('portal', 'plugin', 'api', 'referral')),
  scheduling_supported boolean not null default false,
  supports_online_consultation boolean not null default false,
  supports_in_person_consultation boolean not null default false,
  supports_expungement boolean not null default false,
  supports_211_routing boolean not null default false,
  service_url text,
  contact_email text,
  status text not null default 'active' check (status in ('active', 'inactive', 'pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_services enable row level security;

create policy "partner_services: public read active" on public.partner_services
  for select
  to anon, authenticated
  using (status = 'active');

create policy "partner_services: admin write" on public.partner_services
  for all
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

create index if not exists courier_onboarding_courier_idx on public.courier_onboarding(courier_id);
create index if not exists exchange_courier_contracts_exchange_idx on public.exchange_courier_contracts(exchange_id);
create index if not exists exchange_courier_contracts_courier_idx on public.exchange_courier_contracts(courier_id);
create index if not exists partner_services_type_idx on public.partner_services(partner_type, status);
