"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadCaseAttachment } from "@/lib/cases/collaboration";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CaseAttachment } from "@/types";

interface CaseAttachmentsProps {
  caseId: string;
  attachments: CaseAttachment[];
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CaseAttachments({ caseId, attachments }: CaseAttachmentsProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fileInput = inputRef.current;
    if (!fileInput?.files?.[0]) {
      setError("Choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.set("file", fileInput.files[0]);

    startTransition(async () => {
      const result = await uploadCaseAttachment(caseId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      if (fileInput) {
        fileInput.value = "";
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attachments</CardTitle>
        <CardDescription>
          Upload supporting files (PDF, images, text, Word · max 5MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="space-y-3">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex flex-col gap-1 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{attachment.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(attachment.file_size)} ·{" "}
                    {attachment.uploader?.full_name ?? "User"} ·{" "}
                    {formatDateTime(attachment.created_at)}
                  </p>
                </div>
                {attachment.signed_url ? (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={attachment.signed_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download
                    </a>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleUpload} className="space-y-3 border-t pt-4">
          {error && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="attachment">Add attachment</Label>
            <Input
              id="attachment"
              ref={inputRef}
              type="file"
              disabled={isPending}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,application/pdf,image/*"
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Uploading..." : "Upload file"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
