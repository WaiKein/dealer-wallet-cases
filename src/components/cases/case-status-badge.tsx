import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/auth/roles";
import type { CaseStatus } from "@/types";
import type { BadgeProps } from "@/components/ui/badge";

export function getStatusBadgeVariant(status: CaseStatus): BadgeProps["variant"] {
  switch (status) {
    case "SUBMITTED":
      return "secondary";
    case "UNDER_REVIEW":
      return "default";
    case "WAITING_FOR_REQUESTER":
    case "WAITING_FOR_EXTERNAL_PARTY":
      return "warning";
    case "PENDING_APPROVAL":
      return "warning";
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "destructive";
    case "RESOLVED":
      return "outline";
    default:
      return "secondary";
  }
}

interface CaseStatusBadgeProps {
  status: CaseStatus;
}

export function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  return (
    <Badge variant={getStatusBadgeVariant(status)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
