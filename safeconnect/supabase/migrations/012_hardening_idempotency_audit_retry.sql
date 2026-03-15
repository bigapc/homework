alter table public.exchange_payments
  add column if not exists idempotency_key text,
  add column if not exists checkout_url text;

create unique index if not exists exchange_payments_idempotency_key_unique
  on public.exchange_payments (idempotency_key)
  where idempotency_key is not null;

alter table public.notification_events
  add column if not exists attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists dead_lettered_at timestamptz;

create index if not exists notification_events_retry_idx
  on public.notification_events (status, next_attempt_at, attempts);

alter table public.incident_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.users(id) on delete set null;

alter table public.legal_documents
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.users(id) on delete set null;

create table if not exists public.compliance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.compliance_audit_logs enable row level security;

drop policy if exists "incident_reports: admin update all" on public.incident_reports;
create policy "incident_reports: admin update all" on public.incident_reports
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

drop policy if exists "legal_documents: admin update all" on public.legal_documents;
create policy "legal_documents: admin update all" on public.legal_documents
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

drop policy if exists "compliance_audit_logs: actor select own" on public.compliance_audit_logs;
create policy "compliance_audit_logs: actor select own" on public.compliance_audit_logs
  for select
  using (auth.uid() = actor_user_id);

drop policy if exists "compliance_audit_logs: admin select all" on public.compliance_audit_logs;
create policy "compliance_audit_logs: admin select all" on public.compliance_audit_logs
  for select
  using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid() and me.role = 'admin'
    )
  );

drop policy if exists "compliance_audit_logs: authenticated insert" on public.compliance_audit_logs;
create policy "compliance_audit_logs: authenticated insert" on public.compliance_audit_logs
  for insert
  to authenticated
  with check (auth.uid() = actor_user_id);

create index if not exists compliance_audit_logs_created_idx
  on public.compliance_audit_logs (created_at desc);
create index if not exists compliance_audit_logs_action_idx
  on public.compliance_audit_logs (action, resource_type);
