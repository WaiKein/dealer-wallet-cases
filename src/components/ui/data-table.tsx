import { cn } from "@/lib/utils";

export function DataTable({
  headers,
  children,
  className,
}: {
  headers: React.ReactNode[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ops-panel overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              {headers.map((header, index) => (
                <th key={index} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function DataTableRow({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const content = (
    <tr
      className={cn(
        "transition-colors hover:bg-muted/40",
        href ? "cursor-pointer" : undefined,
        className
      )}
    >
      {children}
    </tr>
  );
  return content;
}

export function DataTableCell({
  children,
  className,
  primary,
}: {
  children: React.ReactNode;
  className?: string;
  primary?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle",
        primary ? "font-medium text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </td>
  );
}
