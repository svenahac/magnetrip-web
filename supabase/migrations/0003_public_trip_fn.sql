-- Magnetrip Phase 1 — public read function (bypasses RLS, exposes only public fields)
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
