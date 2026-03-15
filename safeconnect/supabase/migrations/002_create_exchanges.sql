create table public.exchanges (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.users(id) on delete cascade,
  pickup     text        not null,
  dropoff    text        not null,
  items      text        not null,
  status     text        not null default 'pending' check (status in ('pending', 'assigned', 'completed')),
  courier_id uuid        references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
