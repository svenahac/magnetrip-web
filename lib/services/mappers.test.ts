import { test, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://site.test';
});

const { publicImageUrl, mapImageRow, pickCover, mapTripListItem, mapTripRow } = await import('./mappers');

const imageRow = (over = {}) => ({ id: 'i1', trip_id: 't1', storage_path: 'u1/t1/a.jpg', position: 0, width: null, height: null, ...over });
const tripRow = (over = {}) => ({ id: 't1', user_id: 'u1', name: 'Trip', year: 2024, description: 'd', public_id: 'p1', cover_image_id: null, nfc_tag_id: null, nfc_linked_at: null, created_at: 'c', updated_at: 'u', ...over });

test('publicImageUrl builds the Supabase public object URL', () => {
  expect(publicImageUrl('u1/t1/a.jpg')).toBe('https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/a.jpg');
});

test('mapImageRow converts snake_case row to camelCase DTO with url', () => {
  const dto = mapImageRow(imageRow({ position: 3, width: 800 }));
  expect(dto).toEqual({ id: 'i1', tripId: 't1', storagePath: 'u1/t1/a.jpg', url: 'https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/a.jpg', position: 3, width: 800, height: null });
});

test('pickCover returns the explicit cover when present', () => {
  const rows = [imageRow({ id: 'a', position: 1 }), imageRow({ id: 'b', position: 0 })];
  expect(pickCover('a', rows)?.id).toBe('a');
});

test('pickCover falls back to the lowest position, and null when empty', () => {
  const rows = [imageRow({ id: 'a', position: 2 }), imageRow({ id: 'b', position: 1 })];
  expect(pickCover(null, rows)?.id).toBe('b');
  expect(pickCover('missing', rows)?.id).toBe('b'); // stale cover id → fallback
  expect(pickCover(null, [])).toBeNull();
});

test('mapTripListItem exposes coverUrl and omits owner fields', () => {
  const item = mapTripListItem(tripRow({ cover_image_id: 'a' }), [imageRow({ id: 'a', storage_path: 'u1/t1/cover.jpg', position: 0 })]);
  expect(item.coverUrl).toBe('https://proj.supabase.co/storage/v1/object/public/trip-images/u1/t1/cover.jpg');
  expect(item).not.toHaveProperty('userId');
});

test('mapTripRow includes images sorted mapping and all fields', () => {
  const trip = mapTripRow(tripRow(), [imageRow()]);
  expect(trip.publicId).toBe('p1');
  expect(trip.images).toHaveLength(1);
  expect(trip.images[0].url).toContain('/trip-images/u1/t1/a.jpg');
});
