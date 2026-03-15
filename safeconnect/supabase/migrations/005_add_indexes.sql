-- Speed up lookups by user, courier, and request
create index on public.exchanges (user_id);
create index on public.exchanges (courier_id);
create index on public.tracking  (request_id);
create index on public.tracking  (courier_id);
