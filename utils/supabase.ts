import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

// Lazy initialization to avoid AsyncStorage accessing window during module load
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseInstance;
}

// Export as a getter to ensure lazy initialization
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_, prop) => {
    const client = getSupabaseClient();
    return client[prop as keyof SupabaseClient];
  },
});
