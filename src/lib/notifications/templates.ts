import { createServiceClient } from "@/lib/supabase/api";

/** Escape user-controlled content for email templates (HTML-safe text). */
export function escapeTemplateValue(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    if (!(key in variables)) {
      return "";
    }
    return escapeTemplateValue(variables[key]);
  });
}

export function validateTemplateVariables(params: {
  declared: unknown;
  provided: Record<string, string>;
}): { ok: boolean; missing: string[]; unusedDeclared: string[] } {
  const declared = Array.isArray(params.declared)
    ? params.declared.map(String)
    : [];
  const missing = declared.filter(
    (key) =>
      params.provided[key] == null || String(params.provided[key]).length === 0
  );
  const unusedDeclared = declared.filter((key) => !(key in params.provided));
  return {
    ok: missing.length === 0,
    missing,
    unusedDeclared,
  };
}

export async function resolveEmailTemplate(params: {
  organizationId: string;
  eventType: string;
}): Promise<{
  id: string;
  subject_template: string | null;
  body_template: string;
  variables: unknown;
} | null> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data } = await service
    .from("notification_templates")
    .select("id, subject_template, body_template, variables, effective_from, effective_to")
    .eq("organization_id", params.organizationId)
    .eq("channel", "email")
    .eq("event_type", params.eventType)
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(5);

  const match = (data ?? []).find((row) => {
    if (row.effective_from && row.effective_from > now) return false;
    if (row.effective_to && row.effective_to <= now) return false;
    return true;
  });

  return match
    ? {
        id: match.id,
        subject_template: match.subject_template,
        body_template: match.body_template,
        variables: match.variables,
      }
    : null;
}

export function previewNotificationTemplate(params: {
  subjectTemplate?: string | null;
  bodyTemplate: string;
  variables: Record<string, string>;
  declaredVariables?: unknown;
}): {
  ok: boolean;
  subject: string;
  body: string;
  missing: string[];
} {
  const validation = validateTemplateVariables({
    declared: params.declaredVariables ?? Object.keys(params.variables),
    provided: params.variables,
  });
  return {
    ok: validation.ok,
    subject: renderTemplate(params.subjectTemplate ?? "", params.variables),
    body: renderTemplate(params.bodyTemplate, params.variables),
    missing: validation.missing,
  };
}
