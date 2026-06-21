import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { faceApiLog, faceApiWarn } from "~/utils/faceApiDebug";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
  source: "secure" | "async" | "env";
};

export type FaceApiConfig = {
  url: string;
  source: "secure" | "async" | "env" | "default";
};

const KEY_URL = "sb.url";
const KEY_ANON = "sb.anon";
const KEY_FACE_API_URL = "face.api.url";

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
  const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
  const envAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as
    | string
    | undefined;
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

// --- FACE API CONFIG ---

export async function getFaceApiConfig(): Promise<FaceApiConfig | null> {
  // 1) SecureStore
  const urlSecure = await getFromSecureStore(KEY_FACE_API_URL);
  if (urlSecure) {
    faceApiLog("config:loaded", {
      source: "secure",
      url: urlSecure,
    });
    return { url: urlSecure, source: "secure" };
  }

  // 2) AsyncStorage (legacy fallback)
  const urlAsync = await getFromAsyncStorage(KEY_FACE_API_URL);
  if (urlAsync) {
    faceApiLog("config:loaded-legacy", {
      source: "async",
      url: urlAsync,
      action: "migrate-to-secure-store",
    });
    // Self-heal: migrate to SecureStore
    await setInSecureStore(KEY_FACE_API_URL, urlAsync);
    // Cleanup insecure storage
    await AsyncStorage.removeItem(KEY_FACE_API_URL);
    return { url: urlAsync, source: "async" };
  }

  // 3) Env fallback
  const envUrl = process.env.EXPO_PUBLIC_FACE_API_URL as string | undefined;
  if (envUrl) {
    faceApiLog("config:loaded", {
      source: "env",
      url: envUrl,
      action: "persist-env-value",
    });
    // Persist for future OTA runs
    await Promise.all([
      setInSecureStore(KEY_FACE_API_URL, envUrl),
      setInAsyncStorage(KEY_FACE_API_URL, envUrl),
    ]);
    return { url: envUrl, source: "env" };
  }

  faceApiWarn("config:missing", {
    message: "EXPO_PUBLIC_FACE_API_URL / secure config tidak ditemukan",
  });
  return null;
}

export async function setFaceApiUrl(url: string): Promise<void> {
  faceApiLog("config:set-url", { url });
  await Promise.all([
    setInSecureStore(KEY_FACE_API_URL, url),
    setInAsyncStorage(KEY_FACE_API_URL, url),
  ]);
}

// Cached face API URL for synchronous access after initialization
let cachedFaceApiUrl: string | null = null;

export async function ensureFaceApiConfigured(): Promise<string> {
  if (cachedFaceApiUrl) {
    faceApiLog("config:cache-hit", { url: cachedFaceApiUrl });
    return cachedFaceApiUrl;
  }

  const config = await getFaceApiConfig();
  if (!config) {
    throw new Error("Server verifikasi belum dikonfigurasi. Hubungi administrator.");
  }

  cachedFaceApiUrl = config.url;
  faceApiLog("config:ready", {
    source: config.source,
    url: config.url,
  });
  return config.url;
}

export function getFaceApiUrlSync(): string | null {
  return cachedFaceApiUrl;
}
