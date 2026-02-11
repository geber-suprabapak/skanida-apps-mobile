import { supabase } from "~/utils/supabase";

const AVATAR_BUCKET = "avatars";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const SIGNED_URL_SEGMENT = "/storage/v1/object/sign/avatars/";
const PUBLIC_URL_SEGMENT = "/storage/v1/object/public/avatars/";

// PERF-M04: In-memory cache for signed URLs (avoids re-signing on every render)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function extractAvatarPath(value: string): string | null {
  if (!value) return null;

  if (!value.startsWith("http")) {
    return value;
  }

  const signedIndex = value.indexOf(SIGNED_URL_SEGMENT);
  if (signedIndex !== -1) {
    const pathWithQuery = value.slice(signedIndex + SIGNED_URL_SEGMENT.length);
    const [pathPart] = pathWithQuery.split("?");
    return decodeURIComponent(pathPart);
  }

  const publicIndex = value.indexOf(PUBLIC_URL_SEGMENT);
  if (publicIndex !== -1) {
    const pathPart = value.slice(publicIndex + PUBLIC_URL_SEGMENT.length);
    return decodeURIComponent(pathPart);
  }

  return null;
}

export async function getAvatarSignedUrl(
  value: string | null,
): Promise<string | null> {
  if (!value) return null;

  const isHttpUrl = value.startsWith("http");

  const path = extractAvatarPath(value);
  if (!path) {
    return value;
  }

  // PERF-M04: Check cache first
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return isHttpUrl ? value : null;
  }

  // PERF-M04: Cache the result
  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return data.signedUrl;
}
