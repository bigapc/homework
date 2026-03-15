-- Enable RLS on all tables
alter table public.users     enable row level security;
alter table public.exchanges enable row level security;
alter table public.tracking  enable row level security;

-- ── USERS ──────────────────────────────────────────────────────
-- Users can only read/update their own row
create policy "users: select own" on public.users
  for select using (auth.uid() = id);

create policy "users: update own" on public.users
  for update using (auth.uid() = id);

-- ── EXCHANGES ──────────────────────────────────────────────────
-- Survivors can see their own requests
create policy "exchanges: survivor select own" on public.exchanges
  for select using (auth.uid() = user_id);

-- Survivors can create requests
create policy "exchanges: survivor insert" on public.exchanges
  for insert with check (auth.uid() = user_id);

-- Couriers can see exchanges assigned to them
create policy "exchanges: courier select assigned" on public.exchanges
  for select using (auth.uid() = courier_id);

-- Couriers can update status of their assigned exchanges
create policy "exchanges: courier update assigned" on public.exchanges
  for update using (auth.uid() = courier_id);

-- ── TRACKING ───────────────────────────────────────────────────
-- Couriers can insert and update their own tracking rows
create policy "tracking: courier insert" on public.tracking
  for insert with check (auth.uid() = courier_id);

create policy "tracking: courier update own" on public.tracking
  for update using (auth.uid() = courier_id);

-- Survivors can view tracking for their own exchanges
create policy "tracking: survivor select own exchange" on public.tracking
  for select using (
    exists (
      select 1 from public.exchanges e
      where e.id = tracking.request_id
        and e.user_id = auth.uid()
    )
  );
