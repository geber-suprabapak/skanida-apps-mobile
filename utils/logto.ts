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
export async function saveLogtoSession(session: LogtoSession) {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return sessionToUser(session);
}

export async function getLogtoSession(): Promise<LogtoSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    // SAFETY: SecureStore contains only sessions written by saveLogtoSession.
    const session = JSON.parse(raw) as LogtoSession;
    if (!session.access_token || !session.expires_at) return null;
    if (session.expires_at > Date.now() + 30_000) return session;
    if (!session.refresh_token) return null;
    return await refreshLogtoSession(session);
  } catch {
    await clearLogtoSession();
    return null;
  }
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
  const response = await fetch(`${getEndpoint()}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.EXPO_PUBLIC_LOGTO_APP_ID ?? "skanida-mobile",
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }).toString(),
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
): Promise<LogtoSession> {
  if (!session.refresh_token) return session;
  const response = await fetch(`${getEndpoint()}/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.EXPO_PUBLIC_LOGTO_APP_ID ?? "skanida-mobile",
      refresh_token: session.refresh_token,
    }).toString(),
  });
  if (!response.ok) throw new Error("Sesi identity kedaluwarsa.");
  // SAFETY: The refresh endpoint returned a successful JSON response; required fields are checked below.
  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!token.access_token) throw new Error("Refresh sesi identity gagal.");
  const refreshed = {
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? session.refresh_token,
    expires_at: Date.now() + (token.expires_in ?? 600) * 1000,
    id_token: token.id_token ?? session.id_token,
  };
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(refreshed));
  return refreshed;
}

export async function clearLogtoSession() {
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
