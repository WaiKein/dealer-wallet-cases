import { createServiceClient } from "@/lib/supabase/api";
import type { UserRole } from "@/types";

export async function filterNotificationRecipients(params: {
  organizationId: string;
  recipients: { id: string; role: UserRole; email?: string | null }[];
}): Promise<{ id: string; role: UserRole; email?: string | null }[]> {
  if (!params.recipients.length) {
    return [];
  }

  const service = createServiceClient();
  const { data } = await service
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .in(
      "id",
      params.recipients.map((recipient) => recipient.id)
    );

  const byId = new Map((data ?? []).map((row) => [row.id as string, row]));

  return params.recipients.filter((recipient) => {
    const profile = byId.get(recipient.id);
    return (
      profile &&
      profile.is_active !== false &&
      profile.organization_id === params.organizationId
    );
  });
}
