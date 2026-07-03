import { test, expect } from 'vitest';
import { createTripSchema, updateTripSchema, reorderImagesSchema } from './trip';

test('createTripSchema requires a non-empty name', () => {
  expect(createTripSchema.safeParse({ name: '' }).success).toBe(false);
  expect(createTripSchema.safeParse({ name: 'Amalfi Coast' }).success).toBe(true);
});

test('createTripSchema rejects out-of-range years but allows omission', () => {
  expect(createTripSchema.safeParse({ name: 'Trip', year: 1799 }).success).toBe(false);
  expect(createTripSchema.safeParse({ name: 'Trip', year: 2024 }).success).toBe(true);
  expect(createTripSchema.safeParse({ name: 'Trip' }).success).toBe(true);
});

test('updateTripSchema accepts a partial patch', () => {
  expect(updateTripSchema.safeParse({ description: 'Updated' }).success).toBe(true);
  expect(updateTripSchema.safeParse({}).success).toBe(true);
});

test('reorderImagesSchema requires a non-empty ordered id list', () => {
  expect(reorderImagesSchema.safeParse({ imageIds: [] }).success).toBe(false);
  expect(reorderImagesSchema.safeParse({ imageIds: ['550e8400-e29b-41d4-a716-446655440000'] }).success).toBe(true);
});
