import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already guards this route; this is a defensive backstop.
  if (!user) redirect('/login');

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Your trips</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email}. Your trips will appear here.
      </p>
    </div>
  );
}
