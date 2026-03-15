create table public.safety_share_packets (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.safety_plans(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  trusted_contact_email text not null,
  share_code text unique not null,
  passcode_salt text not null,
  verifier_ciphertext text not null,
  verifier_iv text not null,
  entries_payload jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.safety_share_packets enable row level security;

create policy "safety_share_packets: owner select" on public.safety_share_packets
  for select using (auth.uid() = owner_id);

create policy "safety_share_packets: owner insert" on public.safety_share_packets
  for insert with check (auth.uid() = owner_id);

create policy "safety_share_packets: owner delete" on public.safety_share_packets
  for delete using (auth.uid() = owner_id);

create index on public.safety_share_packets (owner_id);
create index on public.safety_share_packets (expires_at);

create or replace function public.fetch_one_time_safety_share(p_share_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  packet public.safety_share_packets%rowtype;
begin
  select *
    into packet
  from public.safety_share_packets
  where share_code = p_share_code
    and used_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'Invalid or expired share code';
  end if;

  return jsonb_build_object(
    'trusted_contact_email', packet.trusted_contact_email,
    'passcode_salt', packet.passcode_salt,
    'verifier_ciphertext', packet.verifier_ciphertext,
    'verifier_iv', packet.verifier_iv,
    'entries_payload', packet.entries_payload,
    'expires_at', packet.expires_at,
    'created_at', packet.created_at
  );
end;
$$;

create or replace function public.mark_one_time_safety_share_used(p_share_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.safety_share_packets
     set used_at = now()
   where share_code = p_share_code
     and used_at is null
     and expires_at > now();

  return found;
end;
$$;

grant execute on function public.fetch_one_time_safety_share(text) to anon, authenticated;
grant execute on function public.mark_one_time_safety_share_used(text) to anon, authenticated;
