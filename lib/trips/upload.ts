import { apiClient } from '@/lib/api-client';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { fileExtension } from '@/lib/trips/format';
import type { TripImage } from '@/lib/types/trip';

async function readDimensions(file: File): Promise<{ width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return {};
  }
}

/** Upload one image: get a signed URL, PUT the bytes to Storage, then register the DB row. */
export async function uploadTripImage(tripId: string, file: File, position: number): Promise<TripImage> {
  const ext = fileExtension(file.name) || 'jpg';
  const { path, token } = await apiClient.signUpload(tripId, ext);

  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.storage.from('trip-images').uploadToSignedUrl(path, token, file);
  if (error) throw new Error(error.message);

  const { width, height } = await readDimensions(file);
  return apiClient.registerImage(tripId, { storagePath: path, position, width, height });
}
