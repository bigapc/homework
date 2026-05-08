-- Dispatcher finance, supporting documents, and emergency fund tracking

create table if not exists public.dispatcher_financial_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.users(id) on delete set null,
  entry_date date not null default current_date,
  category text not null check (category in ('commercial', 'rideshare', 'uhaul', 'rental_car', 'movers', 'emergency_fund')),
  direction text not null check (direction in ('in', 'out')),
  amount_cents integer not null check (amount_cents >= 0),
  note text
);

create table if not exists public.dispatcher_supporting_docs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null,
  doc_key text not null unique,
  label text not null,
  doc_group text not null check (doc_group in ('tax', 'partnership', 'rideshare', 'uhaul', 'movers')),
  checked boolean not null default false
);

create table if not exists public.dispatcher_financial_settings (
  setting_key text primary key,
  numeric_value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.dispatcher_financial_entries enable row level security;
alter table public.dispatcher_supporting_docs enable row level security;
alter table public.dispatcher_financial_settings enable row level security;

create policy "dispatcher_financial_entries: admin all" on public.dispatcher_financial_entries
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "dispatcher_supporting_docs: admin all" on public.dispatcher_supporting_docs
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

create policy "dispatcher_financial_settings: admin all" on public.dispatcher_financial_settings
  for all
  using (public.is_current_user_admin())
  with check (public.is_current_user_admin());

insert into public.dispatcher_financial_settings (setting_key, numeric_value)
values ('emergency_fund_balance_cents', 500000)
on conflict (setting_key) do nothing;

create index if not exists dispatcher_financial_entries_created_at_idx
  on public.dispatcher_financial_entries (created_at desc);

create index if not exists dispatcher_financial_entries_category_idx
  on public.dispatcher_financial_entries (category, direction);
