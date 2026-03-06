import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "~/utils/secureConfig";

const sessionStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

// Lazy async initialization with runtime config loaded from SecureStore/AsyncStorage/env
let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient> | null = null;

export async function ensureSupabaseInitialized(): Promise<SupabaseClient> {
  if (supabaseInstance) return supabaseInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cfg = await getSupabaseConfig();
      if (!cfg?.url || !cfg?.anonKey) {
        throw new Error(
          "Supabase configuration missing. Please set URL and anon key.",
        );
      }

      const client = createClient(cfg.url, cfg.anonKey, {
        auth: {
          storage: sessionStorageAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });

      supabaseInstance = client;
      return client;
    } catch (error) {
      initPromise = null;
      throw error;
    }
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
