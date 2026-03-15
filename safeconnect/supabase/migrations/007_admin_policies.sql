-- Allow admins to read all users and exchanges, and assign couriers.
-- Uses public.users.role = 'admin' for the currently authenticated user.

create policy "users: admin select all" on public.users
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  );

create policy "exchanges: admin select all" on public.exchanges
  for select using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  );

create policy "exchanges: admin assign courier" on public.exchanges
  for update using (
    exists (
      select 1 from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  ) with check (
    exists (
      select 1 from public.users me
      where me.id = auth.uid()
        and me.role = 'admin'
    )
  );
