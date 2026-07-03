export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
