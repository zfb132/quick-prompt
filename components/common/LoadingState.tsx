import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title: string;
  description?: string;
  className?: string;
}

export function LoadingState({ title, description, className }: LoadingStateProps) {
  return (
    <div className={cn("flex min-h-96 items-center justify-center p-8", className)}>
      <div className="text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
