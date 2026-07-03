'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { loginSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  return (
    <Suspense fallback={<div />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword(parsed.data);
    if (authError) {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your trips">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Sign in'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          No account?{' '}
          <Link href="/signup" className="text-primary hover:underline">Create one</Link>
        </p>
      </form>
    </AuthShell>
  );
}
