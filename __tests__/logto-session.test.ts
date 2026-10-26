import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearLogtoSession,
  getLogtoSession,
  getLogtoUser,
  type MobileAuthUser,
} from "~/utils/logto";
import useAuthStore, {
  SESSION_STORAGE_KEYS,
  type UserProfile,
} from "~/store/authStore";
import { NOTIFICATION_OPT_OUT_PREFIX } from "~/utils/notifications";
import { TIME_SYNC_STORAGE_KEY } from "~/utils/timeSync";

// Module mocking is the only seam available here: expo-web-browser's auth
// session is a native module with no in-memory implementation, and routing
// logto's browser dependency through an injectable parameter would change
// production code. This per-file factory keeps the boundary deliberate.
// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(async () => ({ type: "success" })),
}));

type TestJwtClaims = {
  sub: string;
  name?: string;
  roles?: string[];
};

const createFakeJwt = (claims: TestJwtClaims) => {
  const header = globalThis.btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = globalThis.btoa(JSON.stringify(claims));
  return `${header}.${payload}.signature`;
};

describe("Logto Session Resilience and Deduplication", () => {
  const originalEndpoint = process.env.EXPO_PUBLIC_LOGTO_ENDPOINT;
  const originalAppId = process.env.EXPO_PUBLIC_LOGTO_APP_ID;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    process.env.EXPO_PUBLIC_LOGTO_ENDPOINT = "https://auth.example.com";
    process.env.EXPO_PUBLIC_LOGTO_APP_ID = "skanida-mobile";

    jest
      .spyOn(SecureStore, "getItemAsync")
      .mockImplementation(async (key: string) => mockStore[key] ?? null);
    jest
      .spyOn(SecureStore, "setItemAsync")
      .mockImplementation(async (key: string, value: string) => {
        mockStore[key] = value;
      });
    jest
      .spyOn(SecureStore, "deleteItemAsync")
      .mockImplementation(async (key: string) => {
        delete mockStore[key];
      });
  });

  afterEach(async () => {
    await clearLogtoSession();
    if (originalEndpoint !== undefined) {
      process.env.EXPO_PUBLIC_LOGTO_ENDPOINT = originalEndpoint;
    } else {
      delete process.env.EXPO_PUBLIC_LOGTO_ENDPOINT;
    }
    if (originalAppId !== undefined) {
      process.env.EXPO_PUBLIC_LOGTO_APP_ID = originalAppId;
    } else {
      delete process.env.EXPO_PUBLIC_LOGTO_APP_ID;
    }
    jest.restoreAllMocks();
  });

  it("returns cached session directly when token is valid for > 30s without calling network", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const fakeToken = createFakeJwt({
      sub: "user-1",
      name: "User 1",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "active-token",
      refresh_token: "refresh-1",
      expires_at: Date.now() + 120_000,
      id_token: fakeToken,
    });

    const session = await getLogtoSession();
    expect(session).not.toBeNull();
    expect(session?.access_token).toBe("active-token");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("deduplicates parallel refresh calls so that only one network request is dispatched", async () => {
    const fakeIdToken = createFakeJwt({
      sub: "user-1",
      name: "User 1",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "expired-token",
      refresh_token: "refresh-original",
      expires_at: Date.now() - 10_000,
      id_token: fakeIdToken,
    });

    let fetchCallCount = 0;
    jest.spyOn(global, "fetch").mockImplementation(async () => {
      fetchCallCount++;
      // Add brief async latency to allow parallel calls to overlap
      await new Promise((resolve) => setTimeout(resolve, 50));
      // SAFETY: Mock response envelope for Jest test
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 3600,
          id_token: fakeIdToken,
        }),
      } as Response;
    });

    // Fire 5 parallel getLogtoSession calls concurrently
    const results = await Promise.all([
      getLogtoSession(),
      getLogtoSession(),
      getLogtoSession(),
      getLogtoSession(),
      getLogtoSession(),
    ]);

    expect(fetchCallCount).toBe(1);
    for (const res of results) {
      expect(res).not.toBeNull();
      expect(res?.access_token).toBe("new-access-token");
      expect(res?.refresh_token).toBe("new-refresh-token");
    }
  });

  it("does not wipe session on transient network error during refresh", async () => {
    const fakeIdToken = createFakeJwt({
      sub: "user-offline",
      name: "Offline Student",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "stale-token",
      refresh_token: "refresh-valid",
      expires_at: Date.now() - 5000,
      id_token: fakeIdToken,
    });

    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new TypeError("Network request failed"));

    const deleteSpy = jest.spyOn(SecureStore, "deleteItemAsync");
    const session = await getLogtoSession();

    // Session must not be deleted from store
    expect(deleteSpy).not.toHaveBeenCalled();
    expect(session).not.toBeNull();
    expect(session?.refresh_token).toBe("refresh-valid");

    // getLogtoUser can still read claims offline
    const user = await getLogtoUser();
    expect(user).not.toBeNull();
    expect(user?.id).toBe("user-offline");
    expect(user?.name).toBe("Offline Student");
  });

  it("does not wipe session on 5xx server error during refresh", async () => {
    const fakeIdToken = createFakeJwt({
      sub: "user-srv-err",
      name: "Student",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "stale-token",
      refresh_token: "refresh-valid",
      expires_at: Date.now() - 5000,
      id_token: fakeIdToken,
    });

    // SAFETY: Mock response envelope for Jest test
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 502,
      statusText: "Bad Gateway",
      json: async () => ({ message: "Bad Gateway" }),
    } as Response);

    const deleteSpy = jest.spyOn(SecureStore, "deleteItemAsync");
    const session = await getLogtoSession();

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(session).not.toBeNull();
    expect(session?.access_token).toBe("stale-token");
  });

  it("wipes session and returns null on permanent 400 invalid_grant error", async () => {
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "expired-token",
      refresh_token: "revoked-refresh-token",
      expires_at: Date.now() - 5000,
      id_token: createFakeJwt({ sub: "user-revoked" }),
    });

    // SAFETY: Mock response envelope for Jest test
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: "invalid_grant",
        error_description:
          "The provided authorization grant is invalid, expired, or revoked",
      }),
    } as Response);

    const deleteSpy = jest.spyOn(SecureStore, "deleteItemAsync");
    const session = await getLogtoSession();

    expect(deleteSpy).toHaveBeenCalled();
    expect(session).toBeNull();
    expect(mockStore["astra-logto-session"]).toBeUndefined();
  });

  it("wipes session and returns null when SecureStore content is corrupted JSON", async () => {
    mockStore["astra-logto-session"] = "not-valid-json{{{";

    const deleteSpy = jest.spyOn(SecureStore, "deleteItemAsync");
    const session = await getLogtoSession();

    expect(deleteSpy).toHaveBeenCalled();
    expect(session).toBeNull();
  });

  it("does not wipe session when 400 or 401 returns non-JSON or transient proxy error", async () => {
    const fakeIdToken = createFakeJwt({
      sub: "user-proxy-error",
      name: "Proxy Test",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "stale-token",
      refresh_token: "refresh-preserved",
      expires_at: Date.now() - 5000,
      id_token: fakeIdToken,
    });

    // Mock HTML / non-JSON response from a captive portal or reverse proxy 400/401
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response("<html>Bad Request</html>", {
        status: 400,
        statusText: "Bad Request",
      }),
    );

    const deleteSpy = jest.spyOn(SecureStore, "deleteItemAsync");
    const session = await getLogtoSession();

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(session).not.toBeNull();
    expect(session?.refresh_token).toBe("refresh-preserved");
  });

  it("does not resurrect session if clearLogtoSession is called while refresh is in flight", async () => {
    const fakeIdToken = createFakeJwt({
      sub: "user-logout",
      name: "Logout Student",
      roles: ["student"],
    });
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "expired-token",
      refresh_token: "refresh-logout",
      expires_at: Date.now() - 5000,
      id_token: fakeIdToken,
    });

    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    jest.spyOn(global, "fetch").mockImplementation(() => fetchPromise);

    // Start getLogtoSession - this puts refresh in flight
    const refreshOp = getLogtoSession();

    // User explicitly logs out while refresh is awaiting network
    await clearLogtoSession();
    expect(mockStore["astra-logto-session"]).toBeUndefined();

    // Now network responds with refreshed token
    resolveFetch!(
      new Response(
        JSON.stringify({
          access_token: "resurrected-access-token",
          refresh_token: "resurrected-refresh-token",
          expires_in: 3600,
          id_token: fakeIdToken,
        }),
        { status: 200 },
      ),
    );

    const result = await refreshOp;
    expect(result).toBeNull();
    // SecureStore must NOT contain the resurrected session
    expect(mockStore["astra-logto-session"]).toBeUndefined();
  });
});

describe("Rendered auth state and logout cleanup consistency (M02)", () => {
  const originalEndpoint = process.env.EXPO_PUBLIC_LOGTO_ENDPOINT;
  const originalAppId = process.env.EXPO_PUBLIC_LOGTO_APP_ID;
  let mockStore: Record<string, string> = {};

  const renderedUser: MobileAuthUser = {
    id: "user-render",
    username: "render",
    email: "render@example.com",
    name: "Rendered User",
    roles: ["student"],
    mustChangePassword: false,
  };

  const renderedProfile: UserProfile = {
    id: "user-render",
    user_id: "user-render",
    full_name: "Rendered User",
    email: "render@example.com",
    nis: "12345",
    class_name: "X-A",
    absence_number: "01",
    avatar_url: null,
    role: "student",
    gender: "L",
    notification_token: null,
    lifecycle_status: "approved",
  };

  // Synthetic SecureStore session seed; overrides only carry the primitive
  // session fields (tokens, timestamps) the persisted JSON envelope holds.
  const seedSession = (overrides: Record<string, string | number> = {}) => {
    mockStore["astra-logto-session"] = JSON.stringify({
      access_token: "expired-token",
      refresh_token: "refresh-1",
      expires_at: Date.now() - 5_000,
      id_token: createFakeJwt({ sub: "user-render", roles: ["student"] }),
      ...overrides,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore = {};
    process.env.EXPO_PUBLIC_LOGTO_ENDPOINT = "https://auth.example.com";
    process.env.EXPO_PUBLIC_LOGTO_APP_ID = "skanida-mobile";

    jest
      .spyOn(SecureStore, "getItemAsync")
      .mockImplementation(async (key: string) => mockStore[key] ?? null);
    jest
      .spyOn(SecureStore, "setItemAsync")
      .mockImplementation(async (key: string, value: string) => {
        mockStore[key] = value;
      });
    jest
      .spyOn(SecureStore, "deleteItemAsync")
      .mockImplementation(async (key: string) => {
        delete mockStore[key];
      });

    // Render a session-expired-adjacent UI state: authenticated store + the
    // session-scoped and preference keys that must (not) survive cleanup.
    useAuthStore.setState({ user: renderedUser, userProfile: renderedProfile });
    // SAFETY: the AsyncStorage jest mock (jest.config moduleNameMapper →
    // async-storage-mock) exposes this internal storage map at runtime; the
    // intersection narrows only that member.
    const asyncStorage = AsyncStorage as typeof AsyncStorage & {
      __INTERNAL_MOCK_STORAGE__: Record<string, string>;
    };
    asyncStorage.__INTERNAL_MOCK_STORAGE__ = {
      user_profile_cache: '{"user_id":"user-render","full_name":"cached"}',
      [`${NOTIFICATION_OPT_OUT_PREFIX}:user-render`]: "true",
      [TIME_SYNC_STORAGE_KEY]: JSON.stringify({
        offset: 1200,
        timestamp: Date.now(),
        source: "server",
      }),
    };
  });

  afterEach(async () => {
    await clearLogtoSession();
    useAuthStore.setState({ user: null, userProfile: null });
    if (originalEndpoint !== undefined) {
      process.env.EXPO_PUBLIC_LOGTO_ENDPOINT = originalEndpoint;
    } else {
      delete process.env.EXPO_PUBLIC_LOGTO_ENDPOINT;
    }
    if (originalAppId !== undefined) {
      process.env.EXPO_PUBLIC_LOGTO_APP_ID = originalAppId;
    } else {
      delete process.env.EXPO_PUBLIC_LOGTO_APP_ID;
    }
    jest.restoreAllMocks();
  });

  it("resets the rendered user/profile when an in-session refresh fails permanently with invalid_grant", async () => {
    seedSession();
    // SAFETY: minimal synthetic fetch envelope for the Jest mock; only
    // `ok`, `status`, and `json` are read by the code under test.
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const session = await getLogtoSession();

    expect(session).toBeNull();
    expect(mockStore["astra-logto-session"]).toBeUndefined();
    // The already-rendered screen must not retain stale auth state.
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().userProfile).toBeNull();
    // The passive-expiry handler must remove session-scoped storage too.
    for (const key of SESSION_STORAGE_KEYS) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    // ...while unrelated preferences survive a passive expiry unchanged.
    expect(
      await AsyncStorage.getItem(`${NOTIFICATION_OPT_OUT_PREFIX}:user-render`),
    ).toBe("true");
    expect(await AsyncStorage.getItem(TIME_SYNC_STORAGE_KEY)).not.toBeNull();
  });

  it.each([
    "expired without refresh token",
    "corrupt JSON",
    "missing access token",
  ])("resets rendered auth state for a session with %s", async (scenario) => {
    if (scenario === "corrupt JSON") {
      mockStore["astra-logto-session"] = "not-json";
    } else {
      seedSession(
        scenario === "missing access token"
          ? { access_token: "" }
          : { refresh_token: "" },
      );
    }

    const session = await getLogtoSession();

    expect(session).toBeNull();
    expect(mockStore["astra-logto-session"]).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().userProfile).toBeNull();
    for (const key of SESSION_STORAGE_KEYS) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    expect(
      await AsyncStorage.getItem(`${NOTIFICATION_OPT_OUT_PREFIX}:user-render`),
    ).toBe("true");
  });

  it("keeps the rendered user/profile when a refresh fails transiently", async () => {
    seedSession();
    jest
      .spyOn(global, "fetch")
      .mockRejectedValue(new TypeError("Network request failed"));

    const session = await getLogtoSession();

    expect(session).not.toBeNull();
    expect(mockStore["astra-logto-session"]).toBeDefined();
    expect(useAuthStore.getState().user?.id).toBe("user-render");
    expect(useAuthStore.getState().userProfile?.user_id).toBe("user-render");
  });

  it("logout clears SecureStore and in-memory profile/user but retains notification opt-out and the time cache", async () => {
    seedSession({ expires_at: Date.now() + 120_000 }); // valid session, no refresh needed

    await useAuthStore.getState().logout();

    // SecureStore session cleared (via logoutLogtoSession → clearLogtoSession)
    expect(mockStore["astra-logto-session"]).toBeUndefined();
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalled();
    // In-memory state cleared
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().userProfile).toBeNull();
    // Session-scoped AsyncStorage removed
    for (const key of SESSION_STORAGE_KEYS) {
      expect(await AsyncStorage.getItem(key)).toBeNull();
    }
    // Unrelated preferences retained
    expect(
      await AsyncStorage.getItem(`${NOTIFICATION_OPT_OUT_PREFIX}:user-render`),
    ).toBe("true");
    expect(await AsyncStorage.getItem(TIME_SYNC_STORAGE_KEY)).not.toBeNull();
  });

  it("does not reset rendered state into a resurrected session when logout clears the session mid-refresh", async () => {
    seedSession();

    let resolveFetch: ((value: Response) => void) | undefined;
    jest.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    // Refresh goes in-flight; the user then logs out (not awaited: logout
    // itself awaits the in-flight refresh promise before clearing).
    const refreshOp = getLogtoSession();
    const logoutOp = useAuthStore.getState().logout();

    // Let the refresh actually reach the pending network call before resolving it.
    await new Promise((resolve) => setImmediate(resolve));

    expect(useAuthStore.getState().user).not.toBeNull();

    // The in-flight refresh completes with a permanent rejection: no
    // resurrection and no stale re-render.
    resolveFetch!(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    const result = await refreshOp;
    await logoutOp;
    expect(result).toBeNull();
    expect(mockStore["astra-logto-session"]).toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().userProfile).toBeNull();
  });
});
