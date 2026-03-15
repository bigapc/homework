alter table public.exchanges
  add column items_encrypted boolean not null default false,
  add column encrypted_items_payload text,
  add column encrypted_items_iv text,
  add column encrypted_items_salt text;

create table public.exchange_payments (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dispatch_events (
  id uuid primary key default gen_random_uuid(),
  exchange_id uuid not null references public.exchanges(id) on delete cascade,
  admin_id uuid not null references public.users(id) on delete cascade,
  courier_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('assigned', 'reassigned', 'status_changed', 'note')),
  note text,
  created_at timestamptz not null default now()
);

create table public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exchange_id uuid references public.exchanges(id) on delete set null,
  title text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  details_encrypted text not null,
  details_iv text not null,
  details_salt text not null,
  created_at timestamptz not null default now()
);

create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exchange_id uuid references public.exchanges(id) on delete set null,
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  category text not null default 'other' check (category in ('protection_order', 'court_filing', 'evidence', 'id_document', 'other')),
  created_at timestamptz not null default now()
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exchange_id uuid references public.exchanges(id) on delete set null,
  channel text not null default 'sms' check (channel in ('sms', 'email')),
  recipient text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.exchange_payments enable row level security;
alter table public.dispatch_events enable row level security;
alter table public.incident_reports enable row level security;
alter table public.legal_documents enable row level security;
alter table public.notification_events enable row level security;

create policy "exchange_payments: survivor select own" on public.exchange_payments
  for select using (auth.uid() = user_id);

create policy "exchange_payments: survivor insert own" on public.exchange_payments
  for insert with check (auth.uid() = user_id);

create policy "exchange_payments: admin select all" on public.exchange_payments
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "exchange_payments: admin update all" on public.exchange_payments
  for update using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "dispatch_events: admin insert" on public.dispatch_events
  for insert with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "dispatch_events: admin select all" on public.dispatch_events
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "dispatch_events: survivor select own exchange" on public.dispatch_events
  for select using (
    exists (
      select 1 from public.exchanges e
      where e.id = dispatch_events.exchange_id
        and e.user_id = auth.uid()
    )
  );

create policy "dispatch_events: courier select own exchange" on public.dispatch_events
  for select using (
    exists (
      select 1 from public.exchanges e
      where e.id = dispatch_events.exchange_id
        and e.courier_id = auth.uid()
    )
  );

create policy "incident_reports: survivor select own" on public.incident_reports
  for select using (auth.uid() = user_id);

create policy "incident_reports: survivor insert own" on public.incident_reports
  for insert with check (auth.uid() = user_id);

create policy "incident_reports: admin select all" on public.incident_reports
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "legal_documents: survivor select own" on public.legal_documents
  for select using (auth.uid() = user_id);

create policy "legal_documents: survivor insert own" on public.legal_documents
  for insert with check (auth.uid() = user_id);

create policy "legal_documents: survivor update own" on public.legal_documents
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "legal_documents: survivor delete own" on public.legal_documents
  for delete using (auth.uid() = user_id);

create policy "legal_documents: admin select all" on public.legal_documents
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "notification_events: user select own" on public.notification_events
  for select using (auth.uid() = user_id);

create policy "notification_events: admin select all" on public.notification_events
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "notification_events: admin insert" on public.notification_events
  for insert with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create policy "notification_events: admin update" on public.notification_events
  for update using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

create index exchange_payments_user_id_idx on public.exchange_payments (user_id, created_at desc);
create index exchange_payments_exchange_id_idx on public.exchange_payments (exchange_id, created_at desc);
create index dispatch_events_exchange_id_idx on public.dispatch_events (exchange_id, created_at desc);
create index incident_reports_user_id_idx on public.incident_reports (user_id, created_at desc);
create index legal_documents_user_id_idx on public.legal_documents (user_id, created_at desc);
create index notification_events_status_idx on public.notification_events (status, created_at asc);
