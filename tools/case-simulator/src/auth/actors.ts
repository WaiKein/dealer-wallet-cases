import { ApiClient } from "../api/client.js";
import type { ScenarioActor } from "../types.js";

export interface AuthenticatedActor extends ScenarioActor {
  accessToken: string;
  profile: {
    id: string;
    email: string;
    role: string;
    organization_id: string | null;
  };
  client: ApiClient;
}

export async function authenticateActor(
  baseUrl: string,
  actor: ScenarioActor
): Promise<AuthenticatedActor> {
  const client = new ApiClient(baseUrl);
  const result = await client.request<{
    accessToken: string;
    profile: AuthenticatedActor["profile"];
  }>("POST", "/api/v1/auth/login", {
    email: actor.email,
    password: actor.password,
  });

  if (!result.ok || !result.data?.accessToken) {
    throw new Error(
      `Failed to authenticate ${actor.id} (${actor.email}): ${JSON.stringify(result.raw)}`
    );
  }

  return {
    ...actor,
    accessToken: result.data.accessToken,
    profile: result.data.profile,
    client: client.withToken(result.data.accessToken),
  };
}
