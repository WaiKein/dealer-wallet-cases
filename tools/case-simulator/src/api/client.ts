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
    raw: unknown;
  }> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
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
      error?: string;
      correlationId?: string;
    };

    return {
      ok: response.ok && payload.success !== false,
      status: response.status,
      data: (payload.data ?? raw) as T,
      correlationId: payload.correlationId,
      raw,
    };
  }
}
