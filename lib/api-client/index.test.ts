import { test, expect, vi, afterEach } from 'vitest';
import { apiClient, ApiError } from './index';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('listTrips GETs /api/trips with credentials and returns JSON', async () => {
  const fetchMock = stubFetch(200, [{ id: 't1', name: 'Trip' }]);
  const trips = await apiClient.listTrips();
  expect(trips).toEqual([{ id: 't1', name: 'Trip' }]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips');
  expect(init.credentials).toBe('include');
});

test('createTrip POSTs JSON body', async () => {
  const fetchMock = stubFetch(201, { id: 't2', name: 'New' });
  const trip = await apiClient.createTrip({ name: 'New' });
  expect(trip).toEqual({ id: 't2', name: 'New' });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips');
  expect(init.method).toBe('POST');
  expect(JSON.parse(init.body)).toEqual({ name: 'New' });
});

test('reorderImages PATCHes the reorder endpoint and resolves on 204', async () => {
  const fetchMock = stubFetch(204, undefined);
  await expect(apiClient.reorderImages('t1', ['a', 'b'])).resolves.toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/trips/t1/images/reorder');
  expect(init.method).toBe('PATCH');
});

test('non-2xx throws ApiError carrying status and server message', async () => {
  stubFetch(404, { error: 'Trip not found' });
  await expect(apiClient.getTrip('missing')).rejects.toMatchObject({ name: 'ApiError', status: 404, message: 'Trip not found' });
  await expect(apiClient.getTrip('missing')).rejects.toBeInstanceOf(ApiError);
});
