'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { authErrorMessage } from '@/lib/auth/error-messages';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // The /auth/callback route already exchanged the code and set the recovery session cookie.
  useEffect(() => {
    async function checkSession() {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      setValidSession(Boolean(data.session));
      setReady(true);
    }
    void checkSession();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your details.');
      return;
    }
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: authError } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (authError) {
      setError(authErrorMessage(authError));
      setLoading(false);
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  if (!ready) {
    return (
      <AuthShell title="Reset password">
        <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      </AuthShell>
    );
  }

  if (!validSession) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is invalid or has expired.">
        <Link href="/forgot-password" className="text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you'll remember">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} disabled={loading} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)} disabled={loading} required />
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : 'Update password'}
        </Button>
      </form>
    </AuthShell>
  );
}
