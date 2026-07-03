import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'itest@example.com', password: 'itest-password-123',
  });
  if (authErr) throw new Error('sign-in failed: ' + authErr.message);
  const token = auth.session.access_token;
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const api = async (method, path, body) => {
    const res = await fetch(`${BASE}${path}`, { method, headers: H, body: body && JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  // create → list → get → update → delete
  const created = await api('POST', '/api/trips', { name: 'Integration Trip', year: 2024 });
  if (created.status !== 201) throw new Error('create failed: ' + JSON.stringify(created));
  const id = created.body.id;

  const list = await api('GET', '/api/trips');
  if (!list.body.some((t) => t.id === id)) throw new Error('created trip not in list');

  const patched = await api('PATCH', `/api/trips/${id}`, { description: 'updated' });
  if (patched.body.description !== 'updated') throw new Error('update failed');

  const publicId = created.body.publicId;
  const pub = await api('GET', `/api/public/trips/${publicId}`);
  if (pub.status !== 200 || pub.body.name !== 'Integration Trip') throw new Error('public read failed');
  if ('userId' in pub.body) throw new Error('public read leaked owner data');

  const del = await api('DELETE', `/api/trips/${id}`);
  if (del.status !== 204) throw new Error('delete failed');

  const gone = await api('GET', `/api/trips/${id}`);
  if (gone.status !== 404) throw new Error('expected 404 after delete, got ' + gone.status);

  // unauthenticated request is rejected
  const anon = await fetch(`${BASE}/api/trips`);
  if (anon.status !== 401) throw new Error('expected 401 for unauthenticated list, got ' + anon.status);

  console.log('PHASE 2B INTEGRATION: PASS');
}

main().catch((e) => { console.error('PHASE 2B INTEGRATION: FAIL —', e.message); process.exit(1); });
