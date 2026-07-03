import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="w-full max-w-sm shadow-lg">
      <CardHeader className="space-y-1">
        <div className="text-lg font-extrabold tracking-tight text-primary">Magnetrip</div>
        <CardTitle className="text-xl">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
