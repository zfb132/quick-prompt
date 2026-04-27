import { AlertCircle, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorState({ message, onDismiss }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="size-4" />
      <AlertDescription className="flex items-center justify-between gap-3">
        <span>{message}</span>
        {onDismiss && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="text-destructive hover:bg-destructive/10"
          >
            <X className="size-4" />
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
