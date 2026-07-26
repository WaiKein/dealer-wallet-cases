import { NextResponse } from "next/server";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    { success: true, data, correlationId: crypto.randomUUID() },
    init
  );
}

export function jsonError(
  error: string,
  status = 400,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      success: false,
      error,
      correlationId: crypto.randomUUID(),
      ...extra,
    },
    { status }
  );
}
