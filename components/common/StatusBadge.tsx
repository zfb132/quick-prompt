import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeStatus = "success" | "error" | "loading" | "idle" | "warning";

interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  status: StatusBadgeStatus;
  children: React.ReactNode;
}

export function StatusBadge({ status, children, className, ...props }: StatusBadgeProps) {
  const Icon =
    status === "success"
      ? CheckCircle2
      : status === "error"
        ? XCircle
        : status === "loading"
          ? Loader2
          : Clock3;
  const variant =
    status === "success"
      ? "success"
      : status === "warning"
        ? "warning"
        : status === "error"
          ? "destructive"
          : "muted";

  return (
    <Badge variant={variant} className={cn("gap-1.5", className)} {...props}>
      <Icon className={cn("size-3", status === "loading" && "animate-spin")} />
      {children}
    </Badge>
  );
}
