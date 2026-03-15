create table public.users (
  id         uuid        primary key default gen_random_uuid(),
  email      text        unique not null,
  password   text,
  role       text        not null default 'survivor' check (role in ('survivor', 'courier', 'admin')),
  created_at timestamptz not null default now()
);
