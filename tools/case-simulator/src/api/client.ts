export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private accessToken?: string
  ) {}

  withToken(token: string): ApiClient {
    return new ApiClient(this.baseUrl, token);
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>
  ): Promise<{
    ok: boolean;
    status: number;
    data: T;
    correlationId?: string;
    errorMessage?: string;
    errorCode?: string;
    raw: unknown;
  }> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-correlation-id": crypto.randomUUID(),
      ...extraHeaders,
    };
    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await response.json().catch(() => ({}));
    const payload = raw as {
      success?: boolean;
      data?: T;
      error?: string | { code?: string; message?: string };
      correlationId?: string;
    };

    const errorMessage =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message;
    const errorCode =
      typeof payload.error === "object" ? payload.error?.code : undefined;

    return {
      ok: response.ok && payload.success !== false,
      status: response.status,
      data: (payload.data ?? raw) as T,
      correlationId:
        payload.correlationId ?? response.headers.get("x-correlation-id") ?? undefined,
      errorMessage,
      errorCode,
      raw,
    };
  }
}
