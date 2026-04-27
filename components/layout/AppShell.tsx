import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  className?: string;
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-background text-foreground antialiased",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface PageSurfaceProps {
  children: ReactNode;
  className?: string;
}

export function PageSurface({ children, className }: PageSurfaceProps) {
  return (
    <div
      className={cn(
        "min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.08),transparent_32rem),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.5))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
