import { test, expect, beforeEach } from 'vitest';

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'key';
  process.env.NEXT_PUBLIC_SITE_URL = 'https://magnetrip-web.vercel.app';
});

const { publicTripUrl, descriptionPreview, fileExtension } = await import('./format');

test('publicTripUrl builds the public page URL from the site origin', () => {
  expect(publicTripUrl('abc123')).toBe('https://magnetrip-web.vercel.app/t/abc123');
});

test('descriptionPreview trims, returns empty for null, and truncates with an ellipsis', () => {
  expect(descriptionPreview(null)).toBe('');
  expect(descriptionPreview('  short  ')).toBe('short');
  expect(descriptionPreview('a'.repeat(200), 10)).toBe('aaaaaaaaaa…');
  expect(descriptionPreview('exactly-ten', 11)).toBe('exactly-ten');
});

test('fileExtension returns the lowercased extension, or empty when none', () => {
  expect(fileExtension('Photo.JPG')).toBe('jpg');
  expect(fileExtension('a.b.png')).toBe('png');
  expect(fileExtension('noext')).toBe('');
});
