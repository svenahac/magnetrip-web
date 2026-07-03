import { getPublicEnv } from '@/lib/env';

export function publicTripUrl(publicId: string): string {
  return `${getPublicEnv().siteUrl}/t/${publicId}`;
}

export function descriptionPreview(text: string | null, max = 120): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max) + '…';
}

export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return '';
  return filename.slice(dot + 1).toLowerCase();
}
