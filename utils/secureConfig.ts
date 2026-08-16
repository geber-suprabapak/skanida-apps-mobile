import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  source: "secure" | "async" | "env";
};

const KEY_URL = "sb.url";
const KEY_ANON = "sb.anon";

async function getFromSecureStore(key: string) {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setInSecureStore(key: string, value: string) {
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return;
    await SecureStore.setItemAsync(key, value, {
      keychainService: "skanida.sb",
      requireAuthentication: false,
    });
  } catch {
    // ignore write errors silently; callers can fallback
  }
}

async function getFromAsyncStorage(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setInAsyncStorage(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export async function getSupabaseConfig(): Promise<SupabaseConfig | null> {
  // 1) SecureStore
  const [urlSecure, anonSecure] = await Promise.all([
    getFromSecureStore(KEY_URL),
    getFromSecureStore(KEY_ANON),
  ]);
  if (urlSecure && anonSecure) {
    return { url: urlSecure, anonKey: anonSecure, source: "secure" };
  }

  // 2) AsyncStorage (legacy fallback)
  const [urlAsync, anonAsync] = await Promise.all([
    getFromAsyncStorage(KEY_URL),
    getFromAsyncStorage(KEY_ANON),
  ]);
  if (urlAsync && anonAsync) {
    // Self-heal: migrate to SecureStore
    await Promise.all([
      setInSecureStore(KEY_URL, urlAsync),
      setInSecureStore(KEY_ANON, anonAsync),
    ]);
    // Cleanup insecure storage
    await Promise.all([
      AsyncStorage.removeItem(KEY_URL),
      AsyncStorage.removeItem(KEY_ANON),
    ]);
    return { url: urlAsync, anonKey: anonAsync, source: "async" };
  }

  // 3) Env fallback
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const envAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envAnon) {
    // Persist for future OTA runs
    await Promise.all([
      setInSecureStore(KEY_URL, envUrl),
      setInSecureStore(KEY_ANON, envAnon),
      setInAsyncStorage(KEY_URL, envUrl),
      setInAsyncStorage(KEY_ANON, envAnon),
    ]);
    return { url: envUrl, anonKey: envAnon, source: "env" };
  }

  return null;
}
