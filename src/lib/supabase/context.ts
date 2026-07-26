import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseContext = new AsyncLocalStorage<SupabaseClient>();

export function runWithSupabaseClient<T>(
  client: SupabaseClient,
  fn: () => Promise<T>
): Promise<T> {
  return supabaseContext.run(client, fn);
}

export function getRequestSupabaseClient(): SupabaseClient | null {
  return supabaseContext.getStore() ?? null;
}
