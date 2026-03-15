create table public.courier_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  state text not null,
  vehicle text not null,
  motivation text not null,
  status text not null default 'submitted' check (status in ('submitted', 'reviewing', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.courier_applications enable row level security;

create policy "courier_applications: public insert" on public.courier_applications
  for insert
  to anon, authenticated
  with check (true);

create policy "courier_applications: admin select all" on public.courier_applications
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  );

create policy "courier_applications: admin update" on public.courier_applications
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  );

create index courier_applications_email_idx on public.courier_applications (email);
create index courier_applications_status_idx on public.courier_applications (status, created_at desc);
