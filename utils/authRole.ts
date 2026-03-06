import { supabase } from "~/utils/supabase";

const VALID_ROLES = new Set([
  "admin",
  "kepala_sekolah",
  "guru",
  "wali_kelas",
  "siswa",
]);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );

    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeRole(value: unknown): string | undefined {
  return typeof value === "string" && VALID_ROLES.has(value)
    ? value
    : undefined;
}

export async function resolveUserRole(
  userId: string,
  accessToken: string | null | undefined,
  appMetadata: Record<string, unknown> | undefined,
): Promise<string | undefined> {
  const jwtPayload = accessToken ? decodeJwtPayload(accessToken) : null;
  const jwtAppMetadata = jwtPayload?.app_metadata as
    | Record<string, unknown>
    | undefined;

  const metadataRole =
    normalizeRole(jwtAppMetadata?.role) ?? normalizeRole(appMetadata?.role);

  if (metadataRole) {
    return metadataRole;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error) {
    return undefined;
  }

  return normalizeRole(data?.role);
}
