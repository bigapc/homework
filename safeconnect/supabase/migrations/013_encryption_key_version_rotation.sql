create table if not exists public.encryption_key_registry (
  id uuid primary key default gen_random_uuid(),
  key_version integer not null unique check (key_version > 0),
  algorithm text not null default 'aes-256-gcm+pbkdf2',
  scope text not null default 'application',
  status text not null default 'active' check (status in ('active', 'deprecated', 'retired')),
  activated_at timestamptz not null default now(),
  retired_at timestamptz,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.encryption_key_registry (key_version, status, notes)
values (1, 'active', 'Initial key version')
on conflict (key_version) do nothing;

create table if not exists public.encryption_rotation_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.users(id) on delete cascade,
  from_version integer not null,
  to_version integer not null,
  target_table text not null,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'manual_required', 'failed', 'cancelled')),
  total_count integer not null default 0,
  processed_count integer not null default 0,
  manual_required_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.exchanges
  add column if not exists encryption_key_version integer not null default 1;

alter table public.incident_reports
  add column if not exists encryption_key_version integer not null default 1;

alter table public.safety_plans
  add column if not exists encryption_key_version integer not null default 1;

alter table public.safety_entries
  add column if not exists encryption_key_version integer not null default 1;

alter table public.encryption_key_registry enable row level security;
alter table public.encryption_rotation_jobs enable row level security;

create policy "encryption_key_registry: admin select all" on public.encryption_key_registry
  for select using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create policy "encryption_key_registry: admin insert" on public.encryption_key_registry
  for insert with check (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create policy "encryption_key_registry: admin update" on public.encryption_key_registry
  for update using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  ) with check (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create policy "encryption_rotation_jobs: admin select all" on public.encryption_rotation_jobs
  for select using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create policy "encryption_rotation_jobs: admin insert" on public.encryption_rotation_jobs
  for insert with check (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create policy "encryption_rotation_jobs: admin update" on public.encryption_rotation_jobs
  for update using (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  ) with check (
    exists (select 1 from public.users me where me.id = auth.uid() and me.role = 'admin')
  );

create index if not exists encryption_rotation_jobs_status_idx
  on public.encryption_rotation_jobs (status, created_at desc);

create index if not exists exchanges_key_version_idx
  on public.exchanges (encryption_key_version, created_at desc);

create index if not exists incident_reports_key_version_idx
  on public.incident_reports (encryption_key_version, created_at desc);
