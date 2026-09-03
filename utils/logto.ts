import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

export type MobileAuthUser = {
  id: string;
  username?: string;
  user_metadata?: {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    [key: string]: string | undefined;
  };
  email?: string;
  name?: string;
  roles: string[];
  mustChangePassword: boolean;
};

type LogtoSession = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  id_token?: string;
};

type JwtClaims = {
  sub?: string;
  username?: string;
  email?: string;
  name?: string;
  roles?: string[];
  must_change_password?: boolean | string | number;
};

const SESSION_KEY = "astra-logto-session";

const getEndpoint = () => {
  const endpoint = process.env.EXPO_PUBLIC_LOGTO_ENDPOINT;
  if (!endpoint) throw new Error("Identity provider belum dikonfigurasi.");
  return endpoint.replace(/\/+$/, "");
};

export const getLogtoRedirectUri = () =>
  process.env.EXPO_PUBLIC_LOGTO_REDIRECT_URI ?? "skanida://auth/callback";
export const getLogtoLogoutUri = () =>
  process.env.EXPO_PUBLIC_LOGTO_LOGOUT_URI ?? getLogtoRedirectUri();
function decodeClaims(token: string): JwtClaims {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Token identity tidak valid.");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  // SAFETY: The payload segment was present and base64-decoded; claims are validated below by sub.
  return JSON.parse(globalThis.atob(padded)) as JwtClaims;
}

function sessionToUser(session: LogtoSession): MobileAuthUser {
  const claims = decodeClaims(session.id_token ?? session.access_token);
  if (!claims.sub) throw new Error("Token identity tidak memiliki subject.");
  const mustChangePassword = [true, 1, "true", "1", "yes"].includes(
    claims.must_change_password ?? false,
  );
  return {
    id: claims.sub,
    user_metadata: {
      full_name: claims.name,
      name: claims.name,
    },
    username: claims.username,
    email: claims.email,
    name: claims.name,
    roles: claims.roles ?? [],
    mustChangePassword,
  };
}
export class LogtoPermanentAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LogtoPermanentAuthError";
  }
}

let sessionVersion = 0;
let activeRefreshPromise: Promise<LogtoSession | null> | null = null;

export async function saveLogtoSession(session: LogtoSession) {
  sessionVersion++;
  activeRefreshPromise = null;
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return sessionToUser(session);
}

export async function getLogtoSession(): Promise<LogtoSession | null> {
  if (activeRefreshPromise) {
    return await activeRefreshPromise;
  }

  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  let session: LogtoSession;
  try {
    // SAFETY: SecureStore contains only sessions written by saveLogtoSession.
    session = JSON.parse(raw) as LogtoSession;
  } catch {
    await clearLogtoSession();
    return null;
  }

  if (!session.access_token || !session.expires_at) {
    await clearLogtoSession();
    return null;
  }

  if (session.expires_at > Date.now() + 30_000) {
    return session;
  }

  if (!session.refresh_token) {
    if (session.expires_at <= Date.now()) {
      await clearLogtoSession();
      return null;
    }
    return session;
  }

  if (activeRefreshPromise) {
    return await activeRefreshPromise;
  }

  const currentVersion = sessionVersion;
  activeRefreshPromise = (async () => {
    try {
      // Re-read latest session from SecureStore to avoid redundant network refresh
      // if another concurrent call already refreshed and saved it.
      const latestRaw = await SecureStore.getItemAsync(SESSION_KEY);
      if (!latestRaw || sessionVersion !== currentVersion) {
        return null;
      }
      if (latestRaw !== raw) {
        try {
          // SAFETY: SecureStore contains only sessions written by saveLogtoSession.
          const latestSession = JSON.parse(latestRaw) as LogtoSession;
          if (
            latestSession.access_token &&
            latestSession.expires_at > Date.now() + 30_000
          ) {
            return latestSession;
          }
          if (latestSession.refresh_token) {
            session = latestSession;
          }
        } catch {
          // ignore parsing error
        }
      }

      return await refreshLogtoSession(session, currentVersion);
    } catch (error) {
      if (error instanceof LogtoPermanentAuthError) {
        await clearLogtoSession();
        return null;
      }
      if (sessionVersion !== currentVersion) {
        return null;
      }
      // On network errors or transient refresh failures, preserve the stored
      // session so offline users are not unnecessarily forced to re-login.
      return session;
    } finally {
      if (sessionVersion === currentVersion) {
        activeRefreshPromise = null;
      }
    }
  })();

  return await activeRefreshPromise;
}

export async function getLogtoUser(): Promise<MobileAuthUser | null> {
  const session = await getLogtoSession();
  return session ? sessionToUser(session) : null;
}

export async function getLogtoAccessToken() {
  const session = await getLogtoSession();
  return session?.access_token ?? null;
}

export async function exchangeLogtoCode(
  code: string,
  codeVerifier: string,
  redirectUri = getLogtoRedirectUri(),
) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.EXPO_PUBLIC_LOGTO_APP_ID ?? "skanida-mobile",
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });
  if (process.env.EXPO_PUBLIC_LOGTO_RESOURCE) {
    params.set("resource", process.env.EXPO_PUBLIC_LOGTO_RESOURCE);
  }
  const response = await fetch(`${getEndpoint()}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) throw new Error("Login identity gagal.");
  // SAFETY: The identity token endpoint returned a successful JSON response; required fields are checked below.
  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!token.access_token)
    throw new Error("Identity provider tidak mengembalikan sesi.");
  return saveLogtoSession({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + (token.expires_in ?? 600) * 1000,
    id_token: token.id_token,
  });
}

async function refreshLogtoSession(
  session: LogtoSession,
  expectedVersion?: number,
): Promise<LogtoSession> {
  if (!session.refresh_token) {
    throw new LogtoPermanentAuthError("Tidak ada refresh token.");
  }
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.EXPO_PUBLIC_LOGTO_APP_ID ?? "skanida-mobile",
    refresh_token: session.refresh_token,
  });
  if (process.env.EXPO_PUBLIC_LOGTO_RESOURCE) {
    params.set("resource", process.env.EXPO_PUBLIC_LOGTO_RESOURCE);
  }
  const response = await fetch(`${getEndpoint()}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      let errorType: string | undefined;
      let errorDesc: string | undefined;
      try {
        // SAFETY: Logto OIDC token error response payload format.
        const errorJson = (await response.json()) as {
          error?: string;
          error_description?: string;
        };
        errorType = errorJson.error;
        errorDesc = errorJson.error_description ?? errorJson.error;
      } catch {
        // Non-JSON response indicates a proxy/gateway failure rather than OIDC rejection.
      }
      if (
        errorType === "invalid_grant" ||
        errorType === "unauthorized_client" ||
        errorType === "invalid_client"
      ) {
        throw new LogtoPermanentAuthError(
          errorDesc ?? "Sesi identity kedaluwarsa atau tidak valid.",
        );
      }
    }
    throw new Error(
      `Refresh sesi identity gagal dengan status ${response.status}.`,
    );
  }
  // SAFETY: The refresh endpoint returned a successful JSON response; required fields are checked below.
  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!token.access_token) {
    throw new Error("Refresh sesi identity gagal: tidak ada access token.");
  }
  const refreshed: LogtoSession = {
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? session.refresh_token,
    expires_at: Date.now() + (token.expires_in ?? 600) * 1000,
    id_token: token.id_token ?? session.id_token,
  };
  if (expectedVersion !== undefined && sessionVersion !== expectedVersion) {
    throw new Error("Sesi diubah selama proses refresh.");
  }
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(refreshed));
  return refreshed;
}

export async function clearLogtoSession() {
  sessionVersion++;
  activeRefreshPromise = null;
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function logoutLogtoSession() {
  const session = await getLogtoSession();
  try {
    if (session?.id_token) {
      const logoutUrl = new URL(`${getEndpoint()}/oidc/session/end`);
      logoutUrl.searchParams.set("id_token_hint", session.id_token);
      logoutUrl.searchParams.set(
        "post_logout_redirect_uri",
        getLogtoLogoutUri(),
      );
      await WebBrowser.openAuthSessionAsync(
        logoutUrl.toString(),
        getLogtoLogoutUri(),
      );
    }
  } finally {
    await clearLogtoSession();
  }
}
