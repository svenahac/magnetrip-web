select public.get_public_trip('seedpublic1') as trip,
       public.get_public_trip('does-not-exist') as missing;
