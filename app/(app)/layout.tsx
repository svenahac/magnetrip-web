import { SignOutButton } from '@/components/auth/sign-out-button';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="text-lg font-extrabold tracking-tight text-primary">Magnetrip</span>
        <SignOutButton />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
