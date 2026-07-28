"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCaseComment } from "@/lib/cases/collaboration";
import { canPostInternalComment } from "@/lib/auth/permissions";
import { formatDateTime } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CaseComment, UserRole } from "@/types";

interface CaseCommentsProps {
  caseId: string;
  comments: CaseComment[];
  viewerRole?: UserRole;
}

export function CaseComments({ caseId, comments, viewerRole }: CaseCommentsProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addCaseComment({
        caseId,
        body,
        is_internal: isInternal,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setBody("");
      setIsInternal(false);
      setError(null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
        <CardDescription>Discussion on this case</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded-md border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">
                    {comment.author?.full_name ?? "User"}
                  </span>
                  {comment.author?.role && (
                    <span className="text-muted-foreground">
                      · {ROLE_LABELS[comment.author.role]}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(comment.created_at)}
                  </span>
                  {comment.is_internal ? (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      Internal
                    </span>
                  ) : null}
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 border-t pt-4">
          {error && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="comment-body">Add a comment</Label>
            <Textarea
              id="comment-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              disabled={isPending}
              placeholder="Share an update for the team"
            />
          </div>
          {viewerRole && canPostInternalComment(viewerRole) ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(event) => setIsInternal(event.target.checked)}
                disabled={isPending}
              />
              Internal comment (hidden from requester)
            </label>
          ) : null}
          <Button type="submit" disabled={isPending || !body.trim()}>
            {isPending ? "Posting..." : "Post comment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
