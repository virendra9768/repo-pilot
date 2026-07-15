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
    <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
      <div className="flex items-center gap-2 text-red-300">
        <CircleAlert className="h-4 w-4" />
        <p className="text-sm font-medium">Something went wrong</p>
      </div>
      <p className="mt-1.5 text-sm text-red-400/90">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
