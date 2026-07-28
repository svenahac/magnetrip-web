-- Expect 0: every trip that has images must have a cover, and it must be one of them.
select
  (select count(*) from public.trips t
     where t.cover_image_id is null
       and exists (select 1 from public.trip_images i where i.trip_id = t.id)) as coverless_trips_with_images,
  (select count(*) from public.trips t
     where t.cover_image_id is not null
       and not exists (select 1 from public.trip_images i
                       where i.id = t.cover_image_id and i.trip_id = t.id)) as foreign_covers;
