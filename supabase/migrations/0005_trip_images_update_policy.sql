-- Phase 2b — allow owners to UPDATE their trip images (needed for reorder).
drop policy if exists trip_images_update_own on public.trip_images;
create policy trip_images_update_own on public.trip_images
  for update using (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()))
  with check (exists (
    select 1 from public.trips t where t.id = trip_images.trip_id and t.user_id = auth.uid()));
