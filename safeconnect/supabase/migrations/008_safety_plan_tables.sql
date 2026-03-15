create table public.safety_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid unique not null references public.users(id) on delete cascade,
  trusted_contact_email text not null,
  passcode_salt text not null,
  encrypted_payload text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.safety_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.safety_plans(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('abuse_log', 'protection_order_violation', 'recorded_message', 'court_note', 'other')),
  occurred_at timestamptz not null default now(),
  encrypted_note text not null,
  iv text not null,
  created_at timestamptz not null default now()
);

alter table public.safety_plans enable row level security;
alter table public.safety_entries enable row level security;

create policy "safety_plans: owner select" on public.safety_plans
  for select using (auth.uid() = owner_id);

create policy "safety_plans: owner insert" on public.safety_plans
  for insert with check (auth.uid() = owner_id);

create policy "safety_plans: owner update" on public.safety_plans
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "safety_entries: owner select" on public.safety_entries
  for select using (auth.uid() = owner_id);

create policy "safety_entries: owner insert" on public.safety_entries
  for insert with check (auth.uid() = owner_id);

create policy "safety_entries: owner update" on public.safety_entries
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "safety_entries: owner delete" on public.safety_entries
  for delete using (auth.uid() = owner_id);

create index on public.safety_entries (plan_id);
create index on public.safety_entries (owner_id);
