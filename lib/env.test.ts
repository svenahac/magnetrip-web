import { test, expect, beforeEach, afterEach } from 'vitest';
import { parsePublicEnv } from './env';

test('parsePublicEnv returns config when all vars present', () => {
  const env = parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'key',
    NEXT_PUBLIC_SITE_URL: 'https://magnetrip-web.vercel.app',
  });
  expect(env.siteUrl).toBe('https://magnetrip-web.vercel.app');
  expect(env.supabaseAnonKey).toBe('key');
});

test('parsePublicEnv throws a clear error when a var is missing', () => {
  expect(() => parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '',
    NEXT_PUBLIC_SITE_URL: 'https://magnetrip-web.vercel.app',
  })).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});
