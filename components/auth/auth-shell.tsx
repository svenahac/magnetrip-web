/**
 * The heading block and form slot for the white 55% column. The card wrapper
 * and the text wordmark that used to live here are gone — the white column is
 * the card now, and the wordmark moved to AuthBrandPanel.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
