create table public.tracking (
  id         uuid        primary key default gen_random_uuid(),
  request_id uuid        not null references public.exchanges(id) on delete cascade,
  courier_id uuid        not null references public.users(id) on delete cascade,
  route_lat  double precision,
  route_lng  double precision,
  status     text        not null default 'enroute' check (status in ('enroute', 'delivered', 'canceled')),
  updated_at timestamptz not null default now()
);
