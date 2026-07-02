import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const createTripSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  year: z.number().int().min(1800).max(currentYear + 1).optional(),
  description: z.string().trim().max(5000).optional(),
});

export const updateTripSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  year: z.number().int().min(1800).max(currentYear + 1).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  coverImageId: z.string().uuid().nullable().optional(),
});

export const registerImageSchema = z.object({
  storagePath: z.string().min(1),
  position: z.number().int().min(0),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export const linkNfcSchema = z.object({
  nfcTagId: z.string().min(1).max(255),
});
