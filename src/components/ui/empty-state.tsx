import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ops-panel flex flex-col items-center justify-center gap-2 px-6 py-12 text-center",
        className
      )}
    >
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
