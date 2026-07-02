-- Magnetrip Phase 1 — schema
create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  year int check (year is null or year between 1800 and 2100),
  description text,
  public_id text not null unique default encode(gen_random_bytes(8), 'hex'),
  cover_image_id uuid,
  nfc_tag_id text,
  nfc_linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_images (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);

-- cover_image_id points at a trip_images row (nullable; set null if the image is deleted)
alter table public.trips
  drop constraint if exists trips_cover_image_fk,
  add constraint trips_cover_image_fk
    foreign key (cover_image_id) references public.trip_images (id) on delete set null;

create index if not exists trips_user_id_idx on public.trips (user_id);
create index if not exists trip_images_trip_id_position_idx on public.trip_images (trip_id, position);

-- keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();
