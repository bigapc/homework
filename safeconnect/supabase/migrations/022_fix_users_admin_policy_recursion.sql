-- Prevent recursive RLS evaluation on public.users when checking admin role.
-- The previous policy queried public.users from inside a users policy, which can recurse.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

drop policy if exists "users: admin select all" on public.users;

create policy "users: admin select all" on public.users
  for select
  using (public.is_current_user_admin());
