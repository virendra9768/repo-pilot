import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 dark:border-red-900/60 dark:bg-red-950/40">
      <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
        <CircleAlert className="h-4 w-4" />
        <p className="text-sm font-medium">Something went wrong</p>
      </div>
      <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
