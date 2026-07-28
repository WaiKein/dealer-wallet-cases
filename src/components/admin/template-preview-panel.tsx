"use client";

import { useState, useTransition } from "react";
import { previewNotificationTemplateAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function TemplatePreviewPanel() {
  const [subjectTemplate, setSubjectTemplate] = useState(
    "Case {{case_number}} submitted"
  );
  const [bodyTemplate, setBodyTemplate] = useState(
    "Your case {{case_number}} ({{title}}) has been submitted."
  );
  const [variablesJson, setVariablesJson] = useState(
    '{\n  "case_number": "CASE-1001",\n  "title": "Sample adjustment"\n}'
  );
  const [result, setResult] = useState<{
    ok: boolean;
    subject: string;
    body: string;
    missing: string[];
    error?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  function onPreview() {
    startTransition(async () => {
      let variables: Record<string, string> = {};
      try {
        variables = JSON.parse(variablesJson) as Record<string, string>;
      } catch {
        setResult({
          ok: false,
          subject: "",
          body: "",
          missing: [],
          error: "Variables must be valid JSON object.",
        });
        return;
      }
      const preview = await previewNotificationTemplateAction({
        subjectTemplate,
        bodyTemplate,
        variables,
      });
      setResult(preview);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template preview</CardTitle>
        <CardDescription>
          Render subject/body with sample variables. User values are escaped.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="preview-subject">Subject template</Label>
          <Input
            id="preview-subject"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-body">Body template</Label>
          <Textarea
            id="preview-body"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="preview-vars">Variables (JSON)</Label>
          <Textarea
            id="preview-vars"
            value={variablesJson}
            onChange={(e) => setVariablesJson(e.target.value)}
          />
        </div>
        <Button type="button" disabled={pending} onClick={onPreview}>
          Preview
        </Button>
        {result?.error ? (
          <Alert>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        ) : null}
        {result && !result.error ? (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            {!result.ok ? (
              <p className="text-destructive">
                Missing variables: {result.missing.join(", ") || "none"}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Subject:</span>{" "}
              {result.subject || "—"}
            </p>
            <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">
              {result.body || "—"}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
