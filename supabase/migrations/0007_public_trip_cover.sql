-- Magnetrip Phase 3 — expose the trip cover image on the public read function so the
-- public page can render a hero. Falls back to the lowest-position image when the trip
-- has no explicit cover (mirrors pickCover() in lib/services/mappers.ts).
create or replace function public.get_public_trip(p_public_id text)
returns json
language sql
security definer
set search_path = public
stable
as $$
  select case when t.id is null then null else json_build_object(
    'name', t.name,
    'year', t.year,
    'description', t.description,
    'cover', coalesce(
      (select 'trip-images/' || i.storage_path
       from public.trip_images i where i.id = t.cover_image_id),
      (select 'trip-images/' || i.storage_path
       from public.trip_images i where i.trip_id = t.id
       order by i.position, i.created_at limit 1)),
    'images', coalesce((
      select json_agg(json_build_object(
        'url', 'trip-images/' || i.storage_path,
        'position', i.position) order by i.position)
      from public.trip_images i where i.trip_id = t.id), '[]'::json)
  ) end
  from public.trips t
  where t.public_id = p_public_id;
$$;

revoke all on function public.get_public_trip(text) from public;
grant execute on function public.get_public_trip(text) to anon, authenticated;
