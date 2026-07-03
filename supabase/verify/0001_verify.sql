select
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name in ('trips','trip_images')) as tables,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'trips'
       and column_name in ('id','user_id','name','year','description','public_id',
                           'cover_image_id','nfc_tag_id','nfc_linked_at','created_at','updated_at')) as trip_cols,
  (select count(*) from pg_trigger where tgname = 'trips_set_updated_at') as triggers;
