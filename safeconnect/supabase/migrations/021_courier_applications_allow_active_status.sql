-- Allow activated courier applications to persist final status in workflow

alter table public.courier_applications
  drop constraint if exists courier_applications_status_check;

alter table public.courier_applications
  add constraint courier_applications_status_check
  check (status in ('submitted', 'reviewing', 'approved', 'rejected', 'active'));
