import type { z } from 'zod';
import type {
  createTripSchema, updateTripSchema, registerImageSchema, reorderImagesSchema, linkNfcSchema,
} from '@/lib/validation/trip';

export interface TripImage {
  id: string;
  tripId: string;
  storagePath: string;
  url: string;
  position: number;
  width: number | null;
  height: number | null;
}

export interface Trip {
  id: string;
  userId: string;
  name: string;
  year: number | null;
  description: string | null;
  publicId: string;
  coverImageId: string | null;
  nfcTagId: string | null;
  nfcLinkedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: TripImage[];
}

export interface TripListItem {
  id: string;
  name: string;
  year: number | null;
  description: string | null;
  publicId: string;
  coverUrl: string | null;
  nfcLinkedAt: string | null;
}

export interface PublicTrip {
  name: string;
  year: number | null;
  description: string | null;
  images: { url: string; position: number }[];
}

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type RegisterImageInput = z.infer<typeof registerImageSchema>;
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
export type LinkNfcInput = z.infer<typeof linkNfcSchema>;
