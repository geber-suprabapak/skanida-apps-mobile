import * as SecureStore from "expo-secure-store";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "~/utils/secureConfig";

const secureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

// Lazy async initialization with runtime config loaded from SecureStore/AsyncStorage/env
let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export async function ensureSupabaseInitialized(): Promise<SupabaseClient> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const cfg = await getSupabaseConfig();
    if (!cfg?.url || !cfg?.anonKey) {
      throw new Error(
        "Supabase configuration missing. Please set URL and anon key.",
      );
    }

    const client = createClient(cfg.url, cfg.anonKey, {
      auth: {
        storage: secureStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });

    supabaseInstance = client;
    return client;
  })();

  return initPromise;
}

function getSupabaseClientSync(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error(
      "Supabase client not initialized. Call ensureSupabaseInitialized() first.",
    );
  }
  return supabaseInstance;
}

// Proxy to keep existing usage, but requires ensureSupabaseInitialized() before use.
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => {
    const client = getSupabaseClientSync();
    return client[prop as keyof SupabaseClient];
  },
});
