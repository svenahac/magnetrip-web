-- Magnetrip Phase 1 — security hardening (Supabase advisor findings)
-- 1) Drop the broad public-read SELECT policy on the trip-images bucket. It let
--    anon LIST/enumerate every object ({user_id}/{trip_id}/... across all users).
--    Public trip pages serve images via the bucket's public-URL path, which does
--    NOT require a storage.objects SELECT policy (bucket.public = true handles it).
drop policy if exists trip_images_public_read on storage.objects;

-- 2) Pin search_path on the updated_at trigger function (advisor: function_search_path_mutable).
create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;