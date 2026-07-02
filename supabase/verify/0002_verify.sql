select
  (select count(*) from pg_tables
     where schemaname='public' and tablename in ('trips','trip_images') and rowsecurity) as rls_tables,
  (select count(*) from pg_policies
     where schemaname='public' and tablename in ('trips','trip_images')) as table_policies,
  (select count(*) from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname like 'trip_images_%') as storage_policies,
  (select public from storage.buckets where id='trip-images') as bucket_public;
