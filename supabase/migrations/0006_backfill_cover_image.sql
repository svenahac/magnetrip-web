-- Backfill covers for trips that predate the auto-cover rule in images.service.ts.
-- Ordering matches pickCover()/coverAfterDelete(): lowest position wins.
update public.trips t
set cover_image_id = (
  select i.id from public.trip_images i
  where i.trip_id = t.id
  order by i.position, i.created_at
  limit 1)
where t.cover_image_id is null
  and exists (select 1 from public.trip_images i where i.trip_id = t.id);
