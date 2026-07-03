import { redirect } from 'next/navigation';

export default function Home() {
  // Middleware redirects unauthenticated users to /login.
  redirect('/dashboard');
}
