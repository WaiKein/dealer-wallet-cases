"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reassignCaseAction } from "@/lib/cases/collaboration";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReassignAgentFormProps {
  caseId: string;
  currentAgentId: string | null;
  agents: { id: string; full_name: string; email: string }[];
}

export function ReassignAgentForm({
  caseId,
  currentAgentId,
  agents,
}: ReassignAgentFormProps) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(currentAgentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await reassignCaseAction({ caseId, agentId });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (agents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reassign within group</CardTitle>
        <CardDescription>
          Team leads can reassign this case to another group member.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isPending || !agentId}>
            {isPending ? "Reassigning..." : "Reassign"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
