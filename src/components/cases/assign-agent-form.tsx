"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignCaseToAgent } from "@/lib/cases/collaboration";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AssignAgentFormProps {
  caseId: string;
  currentAgentId: string | null;
  agents: { id: string; full_name: string; email: string }[];
}

export function AssignAgentForm({
  caseId,
  currentAgentId,
  agents,
}: AssignAgentFormProps) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(currentAgentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!agentId) {
      setError("Select an agent.");
      return;
    }

    startTransition(async () => {
      const result = await assignCaseToAgent({ caseId, agentId });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assign agent</CardTitle>
        <CardDescription>
          Choose an operations agent to own this case.
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
            <Label htmlFor="agent">Operations agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="agent">
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
            {isPending ? "Assigning..." : "Assign agent"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
