import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <AuthBrandPanel />
      <main className="flex flex-1 items-center justify-center bg-card px-6 py-10">
        {children}
      </main>
    </div>
  );
}
