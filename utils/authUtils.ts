export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
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

export function resolveUserRole(
  accessToken: string | null | undefined,
  appMetadata: Record<string, unknown> | undefined,
): string | undefined {
  const jwtPayload = accessToken ? decodeJwtPayload(accessToken) : null;
  const jwtAppMetadata = jwtPayload?.app_metadata as
    | Record<string, unknown>
    | undefined;

  return (
    (jwtAppMetadata?.role as string | undefined) ??
    (appMetadata?.role as string | undefined)
  );
}
