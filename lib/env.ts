type RawEnv = Record<string, string | undefined>;

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  siteUrl: string;
}

export function parsePublicEnv(raw: RawEnv): PublicEnv {
  const require = (key: string): string => {
    const value = raw[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
  };
  return {
    supabaseUrl: require('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: require('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    siteUrl: require('NEXT_PUBLIC_SITE_URL'),
  };
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
