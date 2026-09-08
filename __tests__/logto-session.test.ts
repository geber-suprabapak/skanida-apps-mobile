import * as SecureStore from "expo-secure-store";
import {
  clearLogtoSession,
  getLogtoSession,
  getLogtoUser,
} from "~/utils/logto";

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
