import {
  ActiveBadge,
  AdminFilterBar,
  AdminUpsertForm,
  EmptyState,
} from "@/components/admin/admin-ui";
import { TemplatePreviewPanel } from "@/components/admin/template-preview-panel";
import { adminUpsertNotificationTemplateAction } from "@/lib/admin/actions";
import { listAdminNotificationTemplates } from "@/lib/admin/config";
import { requireAdmin } from "@/lib/auth/session";

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
      <AdminFilterBar q={params.q} active={params.active} />
      <TemplatePreviewPanel />
      <AdminUpsertForm
        title="Create notification template"
        fields={[
          { name: "code", label: "Code", type: "text" },
          { name: "name", label: "Name", type: "text" },
          {
            name: "channel",
            label: "Channel",
            type: "select",
            options: [
              { value: "email", label: "Email" },
              { value: "in_app", label: "In-app" },
            ],
          },
          { name: "event_type", label: "Event type", type: "text" },
          { name: "subject_template", label: "Subject template", type: "text" },
          { name: "body_template", label: "Body template", type: "textarea" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
        action={adminUpsertNotificationTemplateAction}
        submitLabel="Create template"
      />
      {result.data.items.length === 0 ? (
        <EmptyState message="No templates found." />
      ) : (
        result.data.items.map((item) => (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{item.name}</p>
              <ActiveBadge active={item.is_active} />
            </div>
            <p className="text-sm text-muted-foreground">
              {item.channel} · {item.event_type} · v{item.version}
            </p>
            <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
              {item.subject_template ? `${item.subject_template}\n\n` : ""}
              {item.body_template}
            </pre>
          </div>
        ))
      )}
    </div>
  );
}
