export type UserAppMetadata = {
  role?: string;
  provider?: string;
  providers?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
};

export type JwtPayload = {
  app_metadata?: UserAppMetadata;
  role?: string;
  [key: string]:
    | string
    | number
    | boolean
    | string[]
    | UserAppMetadata
    | undefined;
};

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    // SAFETY: Base64 payload parses into standard JWT claims format.
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

export function resolveUserRole(
  accessToken: string | null | undefined,
  appMetadata: UserAppMetadata | undefined,
): string | undefined {
  const jwtPayload = accessToken ? decodeJwtPayload(accessToken) : null;
  const jwtRole = jwtPayload?.app_metadata?.role ?? jwtPayload?.role;
  return jwtRole ?? appMetadata?.role;
}
