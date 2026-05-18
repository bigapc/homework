create table if not exists public.client_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  exchange_id uuid references public.exchanges(id) on delete set null,
  entry_date date not null default current_date,
  entry_type text not null default 'journal',
  title text not null,
  body text,
  contact_name text,
  contact_method text,
  email_to text,
  email_subject text,
  reminder_at timestamptz,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_journal_entries_type_check check (entry_type in ('journal', 'calendar', 'email_log', 'case_note', 'reminder')),
  constraint client_journal_entries_status_check check (status in ('open', 'done', 'archived'))
);

create index if not exists idx_client_journal_entries_user_date
on public.client_journal_entries(user_id, entry_date desc);

create index if not exists idx_client_journal_entries_user_type
on public.client_journal_entries(user_id, entry_type);

create index if not exists idx_client_journal_entries_exchange_id
on public.client_journal_entries(exchange_id);

create index if not exists idx_client_journal_entries_reminder_at
on public.client_journal_entries(reminder_at)
where reminder_at is not null;

alter table public.client_journal_entries enable row level security;

drop policy if exists "Clients can manage own journal entries" on public.client_journal_entries;
create policy "Clients can manage own journal entries"
on public.client_journal_entries
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can view client journal entries" on public.client_journal_entries;
create policy "Admins can view client journal entries"
on public.client_journal_entries
for select
to authenticated
using (public.is_safeconnect_admin());

create or replace function public.set_client_journal_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_client_journal_entries_updated_at on public.client_journal_entries;
create trigger set_client_journal_entries_updated_at
before update on public.client_journal_entries
for each row execute function public.set_client_journal_entries_updated_at();

notify pgrst, 'reload schema';
