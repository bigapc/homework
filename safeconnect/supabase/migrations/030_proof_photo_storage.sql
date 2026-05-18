insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'safeconnect-private-documents',
  'safeconnect-private-documents',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "SafeConnect proof files are viewable by related parties" on storage.objects;
create policy "SafeConnect proof files are viewable by related parties"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'safeconnect-private-documents'
  and (storage.foldername(name))[1] = 'exchange-proofs'
  and (
    public.is_safeconnect_admin()
    or exists (
      select 1
      from public.exchanges e
      where e.id::text = (storage.foldername(name))[2]
      and (e.user_id = auth.uid() or e.courier_id = auth.uid())
    )
  )
);

drop policy if exists "Assigned couriers can upload SafeConnect proof files" on storage.objects;
create policy "Assigned couriers can upload SafeConnect proof files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'safeconnect-private-documents'
  and (storage.foldername(name))[1] = 'exchange-proofs'
  and exists (
    select 1
    from public.exchanges e
    where e.id::text = (storage.foldername(name))[2]
    and e.courier_id = auth.uid()
  )
);

drop policy if exists "Assigned couriers can update SafeConnect proof files" on storage.objects;
create policy "Assigned couriers can update SafeConnect proof files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'safeconnect-private-documents'
  and (storage.foldername(name))[1] = 'exchange-proofs'
  and exists (
    select 1
    from public.exchanges e
    where e.id::text = (storage.foldername(name))[2]
    and e.courier_id = auth.uid()
  )
)
with check (
  bucket_id = 'safeconnect-private-documents'
  and (storage.foldername(name))[1] = 'exchange-proofs'
  and exists (
    select 1
    from public.exchanges e
    where e.id::text = (storage.foldername(name))[2]
    and e.courier_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
