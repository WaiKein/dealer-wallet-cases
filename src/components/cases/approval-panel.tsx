import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ApprovalPanel({
  request,
  steps,
}: {
  request: {
    status: string;
    requested_amount: number;
    approved_amount: number | null;
    approval_levels: number;
    approval_rule_code: string | null;
    version: number;
  } | null;
  steps: {
    id: string;
    level_no: number;
    status: string;
    required_role: string | null;
    decided_by: string | null;
    decided_as_delegate_of: string | null;
    rejection_reason: string | null;
  }[];
}) {
  if (!request) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval</CardTitle>
        <CardDescription>
          Request status {request.status}
          {request.approval_rule_code
            ? ` · rule ${request.approval_rule_code}`
            : " · default rule"}
          {` · v${request.version}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Requested {Number(request.requested_amount).toFixed(2)}
          {request.approved_amount != null
            ? ` · approved ${Number(request.approved_amount).toFixed(2)}`
            : ""}
          {` · ${request.approval_levels} level(s)`}
        </p>
        <ul className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <span>
                Level {step.level_no}
                {step.required_role ? ` · ${step.required_role}` : ""}
                {step.decided_as_delegate_of
                  ? " · via delegation"
                  : ""}
              </span>
              <Badge variant={step.status === "APPROVED" ? "default" : "outline"}>
                {step.status}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
