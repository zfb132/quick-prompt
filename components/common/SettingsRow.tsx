import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SettingsRowProps {
  title: string;
  description?: string;
  control: ReactNode;
  className?: string;
}

export function SettingsRow({
  title,
  description,
  control,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
