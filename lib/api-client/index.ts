import type {
  Trip, TripListItem, TripImage, PublicTrip,
  CreateTripInput, UpdateTripInput, RegisterImageInput,
} from '@/lib/types/trip';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface SignedUpload {
  path: string;
  token: string;
  signedUrl: string;
}

export const apiClient = {
  listTrips: () => request<TripListItem[]>('/api/trips'),
  getTrip: (id: string) => request<Trip>(`/api/trips/${id}`),
  createTrip: (input: CreateTripInput) => request<Trip>('/api/trips', { method: 'POST', body: input }),
  updateTrip: (id: string, input: UpdateTripInput) => request<Trip>(`/api/trips/${id}`, { method: 'PATCH', body: input }),
  deleteTrip: (id: string) => request<void>(`/api/trips/${id}`, { method: 'DELETE' }),
  signUpload: (tripId: string, ext: string) => request<SignedUpload>('/api/uploads/sign', { method: 'POST', body: { tripId, ext } }),
  registerImage: (tripId: string, input: RegisterImageInput) => request<TripImage>(`/api/trips/${tripId}/images`, { method: 'POST', body: input }),
  reorderImages: (tripId: string, imageIds: string[]) => request<void>(`/api/trips/${tripId}/images/reorder`, { method: 'PATCH', body: { imageIds } }),
  deleteImage: (imageId: string) => request<void>(`/api/images/${imageId}`, { method: 'DELETE' }),
  bulkDeleteImages: (tripId: string, imageIds: string[]) =>
    request<{ deleted: number }>(`/api/trips/${tripId}/images/bulk-delete`, { method: 'POST', body: { imageIds } }),
  linkNfc: (tripId: string, nfcTagId: string) => request<Trip>(`/api/trips/${tripId}/nfc`, { method: 'PATCH', body: { nfcTagId } }),
  getPublicTrip: (publicId: string) => request<PublicTrip>(`/api/public/trips/${publicId}`),
};
