select
  (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
     and policyname='trip_images_public_read') as public_read_present,
  (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
     and policyname like 'trip_images_%') as trip_images_storage_policies,
  (select array_to_string(p.proconfig, ',') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='set_updated_at') as set_updated_at_config;