import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { AdminEditorPanel } from "@/components/admin/admin-editor-panel";
import { TemplatePreviewPanel } from "@/components/admin/template-preview-panel";
import { PageHeader } from "@/components/layout/page-header";
import { adminUpsertNotificationTemplateAction } from "@/lib/admin/actions";
import { listAdminNotificationTemplates } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

const templateFields = [
  { name: "code", label: "Code", type: "text" as const },
  { name: "name", label: "Name", type: "text" as const },
  {
    name: "channel",
    label: "Channel",
    type: "select" as const,
    options: [
      { value: "email", label: "Email" },
      { value: "in_app", label: "In-app" },
    ],
  },
  { name: "event_type", label: "Event type", type: "text" as const },
  { name: "subject_template", label: "Subject template", type: "text" as const },
  { name: "body_template", label: "Body template", type: "textarea" as const },
  { name: "is_active", label: "Active", type: "checkbox" as const },
];

export default async function AdminNotificationTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;
  const result = await listAdminNotificationTemplates(profile, {
    q: params.q,
    active: (params.active as "all" | "active" | "inactive") ?? "all",
  });
  if (!result.success || !result.data) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication & control"
        title="Notification templates"
        description={`${result.data.items.length} templates · event copy`}
      />
      <AdminFilterBar q={params.q} active={params.active} />
      <TemplatePreviewPanel />
      <AdminEditorPanel title="Create notification template" triggerLabel="New template">
        <AdminUpsertForm
          title="Create notification template"
          fields={templateFields}
          action={adminUpsertNotificationTemplateAction}
          submitLabel="Create template"
        />
      </AdminEditorPanel>
      {result.data.items.length === 0 ? (
        <EmptyState message="No templates found." />
      ) : (
        <div className="space-y-3">
          {result.data.items.map((item) => (
            <div key={item.id} className="ops-panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.channel} · {item.event_type} · v{item.version}
                  </p>
                </div>
                <ActiveBadge active={item.is_active} />
              </div>
              <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
                {item.subject_template ? `${item.subject_template}\n\n` : ""}
                {item.body_template}
              </pre>
              <details className="rounded-md border bg-muted/20 p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Edit {item.name}
                </summary>
                <div className="mt-3">
                  <AdminUpsertForm
                    title={`Edit ${item.name}`}
                    initial={item as unknown as Record<string, unknown>}
                    fields={templateFields}
                    action={adminUpsertNotificationTemplateAction}
                    submitLabel="Save template"
                  />
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
