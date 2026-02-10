import { supabase } from "~/utils/supabase";

const AVATAR_BUCKET = "avatars";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const SIGNED_URL_SEGMENT = "/storage/v1/object/sign/avatars/";
const PUBLIC_URL_SEGMENT = "/storage/v1/object/public/avatars/";

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

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return isHttpUrl ? value : null;
  }

  return data.signedUrl;
}
