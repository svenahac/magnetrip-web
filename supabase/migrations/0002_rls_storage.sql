-- Magnetrip Phase 1 — RLS + storage
alter table public.trips enable row level security;
alter table public.trip_images enable row level security;

-- trips: owner-only for all verbs
drop policy if exists trips_select_own on public.trips;
create policy trips_select_own on public.trips
  for select using (user_id = auth.uid());
drop policy if exists trips_insert_own on public.trips;
create policy trips_insert_own on public.trips
  for insert with check (user_id = auth.uid());
drop policy if exists trips_update_own on public.trips;
create policy trips_update_own on public.trips
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists trips_delete_own on public.trips;
create policy trips_delete_own on public.trips
  for delete using (user_id = auth.uid());

-- trip_images: owner-only via the parent trip
drop policy if exists trip_images_select_own on public.trip_images;
create policy trip_images_select_own on public.trip_images
  for select using (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()));
drop policy if exists trip_images_insert_own on public.trip_images;
create policy trip_images_insert_own on public.trip_images
  for insert with check (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()));
drop policy if exists trip_images_delete_own on public.trip_images;
create policy trip_images_delete_own on public.trip_images
  for delete using (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()));

-- storage bucket: public read, owner-scoped writes ({user_id}/{trip_id}/file)
insert into storage.buckets (id, name, public)
  values ('trip-images', 'trip-images', true)
  on conflict (id) do update set public = true;

drop policy if exists trip_images_public_read on storage.objects;
create policy trip_images_public_read on storage.objects
  for select using (bucket_id = 'trip-images');

drop policy if exists trip_images_owner_write on storage.objects;
create policy trip_images_owner_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trip-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists trip_images_owner_delete on storage.objects;
create policy trip_images_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'trip-images' and (storage.foldername(name))[1] = auth.uid()::text);
