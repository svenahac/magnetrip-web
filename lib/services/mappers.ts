import type { Trip, TripImage, TripListItem } from '@/lib/types/trip';
import { getPublicEnv } from '@/lib/env';

export interface ImageRow {
  id: string;
  trip_id: string;
  storage_path: string;
  position: number;
  width: number | null;
  height: number | null;
}

export interface TripRow {
  id: string;
  user_id: string;
  name: string;
  year: number | null;
  description: string | null;
  public_id: string;
  cover_image_id: string | null;
  nfc_tag_id: string | null;
  nfc_linked_at: string | null;
  created_at: string;
  updated_at: string;
}

export function publicImageUrl(storagePath: string): string {
  const { supabaseUrl } = getPublicEnv();
  return `${supabaseUrl}/storage/v1/object/public/trip-images/${storagePath}`;
}

export function mapImageRow(row: ImageRow): TripImage {
  return {
    id: row.id,
    tripId: row.trip_id,
    storagePath: row.storage_path,
    url: publicImageUrl(row.storage_path),
    position: row.position,
    width: row.width,
    height: row.height,
  };
}

export function pickCover(coverImageId: string | null, rows: ImageRow[]): ImageRow | null {
  if (coverImageId) {
    const match = rows.find((r) => r.id === coverImageId);
    if (match) return match;
  }
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => a.position - b.position)[0];
}

export function mapTripListItem(row: TripRow, imageRows: ImageRow[]): TripListItem {
  const cover = pickCover(row.cover_image_id, imageRows);
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    description: row.description,
    publicId: row.public_id,
    coverUrl: cover ? publicImageUrl(cover.storage_path) : null,
    nfcLinkedAt: row.nfc_linked_at,
  };
}

export function mapTripRow(row: TripRow, imageRows: ImageRow[]): Trip {
  const images = [...imageRows].sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    year: row.year,
    description: row.description,
    publicId: row.public_id,
    coverImageId: row.cover_image_id,
    nfcTagId: row.nfc_tag_id,
    nfcLinkedAt: row.nfc_linked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: images.map(mapImageRow),
  };
}
