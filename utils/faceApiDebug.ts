import * as Sentry from "@sentry/react-native";

const PREFIX = "[FaceAPI DEV]";
const MAX_STRING_PREVIEW = 900;
const MAX_DEPTH = 4;

type Jsonish =
  | string
  | number
  | boolean
  | null
  | undefined
  | Jsonish[]
  | { [key: string]: Jsonish };

type HeaderMap = Record<string, string | number | boolean | null | undefined>;

const isDevLoggingEnabled = () => __DEV__ === true;

const round = (value: number, precision = 3) =>
  Number(value.toFixed(precision));

const summarizeSecret = (cause: unknown) => {
  if (cause === "[redacted]") return "[redacted]";
  if (Object.prototype.toString.call(cause) !== "[object String]") {
    return "[redacted]";
  }
  const str = String(cause);
  const scheme = str.startsWith("Bearer ") ? "Bearer" : "secret";
  return `[redacted ${scheme}, length=${str.length}]`;
};

const normalizeHeaders = (cause: unknown) => {
  if (cause === null || cause === undefined) return undefined;

  if (cause instanceof Headers) {
    const collected: HeaderMap = {};
    cause.forEach((value, key) => {
      collected[key] = value;
    });
    return normalizeHeaders(collected);
  }

  if (Object.prototype.toString.call(cause) !== "[object Object]") {
    return undefined;
  }

  // SAFETY: Checked that cause is an Object record.
  const entries = Object.entries(cause as HeaderMap).map(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("authorization") ||
      lowerKey.includes("token") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("key")
    ) {
      return [key, summarizeSecret(value)];
    }
    return [key, value];
  });

  return Object.fromEntries(entries);
};

const normalizeDebugValue = (cause: unknown, depth = 0): Jsonish => {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (cause === null || cause === undefined) return cause;

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  const tag = Object.prototype.toString.call(cause);

  if (tag === "[object String]") {
    const str = String(cause);
    if (str.length <= MAX_STRING_PREVIEW) return str;
    return {
      preview: str.slice(0, MAX_STRING_PREVIEW),
      truncated: true,
      length: str.length,
    };
  }

  if (tag === "[object Number]" || tag === "[object Boolean]") {
    // SAFETY: Verified number or boolean primitive tag.
    return cause as number | boolean;
  }

  if (tag === "[object BigInt]") {
    return String(cause);
  }

  if (Array.isArray(cause)) {
    return cause.map((item) => normalizeDebugValue(item, depth + 1));
  }

  if (tag === "[object Object]") {
    // SAFETY: Verified Object dictionary type before reading entries.
    const entries = Object.entries(cause as Record<string, Jsonish>).map(
      ([key, item]) => {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("authorization") ||
          lowerKey.includes("token") ||
          lowerKey === "image_base64" ||
          lowerKey === "base64" ||
          lowerKey.endsWith("_base64")
        ) {
          return [key, summarizeSecret(item)];
        }
        return [key, normalizeDebugValue(item, depth + 1)];
      },
    );
    return Object.fromEntries(entries);
  }

  return String(cause);
};

export const bytesInfo = (bytes: number) => ({
  bytes,
  kb: round(bytes / 1024, 2),
  mb: round(bytes / (1024 * 1024), 3),
});

export const startFaceApiTimer = () => Date.now();

export const elapsedMs = (startedAt: number) => Date.now() - startedAt;

const captureFaceApiProductionEvent = (
  level: "warning" | "error",
  event: string,
  payload: Jsonish,
  cause?: unknown,
) => {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "face-api");
    scope.setTag("event", event);
    scope.setLevel(level);
    scope.setContext("face_api", {
      event,
      payload: payload ?? null,
    });

    if (level === "error" && cause instanceof Error) {
      Sentry.captureException(cause);
      return;
    }

    Sentry.captureMessage(`Face API ${level}: ${event}`);
  });
};

export const faceApiLog = (event: string, cause?: unknown) => {
  if (!isDevLoggingEnabled()) return;
  console.log(`${PREFIX} ${event}`, normalizeDebugValue(cause));
};

export const faceApiWarn = (event: string, cause?: unknown) => {
  const normalizedPayload = normalizeDebugValue(cause);
  if (isDevLoggingEnabled()) {
    console.warn(`${PREFIX} ${event}`, normalizedPayload);
    return;
  }

  captureFaceApiProductionEvent("warning", event, normalizedPayload, cause);
};

export const faceApiError = (event: string, cause?: unknown) => {
  const normalizedPayload = normalizeDebugValue(cause);
  if (isDevLoggingEnabled()) {
    console.warn(`${PREFIX} ${event}`, normalizedPayload);
    return;
  }

  captureFaceApiProductionEvent("error", event, normalizedPayload, cause);
};

export const sessionDebugInfo = (
  session: {
    access_token?: string | null;
    expires_at?: number | null;
    user?: {
      id?: string;
      email?: string;
      user_metadata?: Record<
        string,
        string | number | boolean | null | undefined
      >;
    } | null;
  } | null,
) => ({
  hasSession: Boolean(session),
  hasAccessToken: Boolean(session?.access_token),
  tokenLength: session?.access_token?.length ?? 0,
  expiresAt: session?.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null,
  userId: session?.user?.id ?? null,
  email: session?.user?.email ?? null,
  name:
    session?.user?.user_metadata?.full_name ??
    session?.user?.user_metadata?.name ??
    null,
});

interface AxiosLikeError {
  name?: string;
  message?: string;
  code?: string;
  response?: {
    status?: number;
    statusText?: string;
    headers?: HeaderMap;
    data?: Jsonish;
  };
  config?: {
    method?: string;
    url?: string;
    baseURL?: string;
    timeout?: number;
    headers?: HeaderMap;
  };
  isAxiosError: boolean;
}

const isAxiosLikeError = (cause: unknown): cause is AxiosLikeError => {
  if (cause === null || cause === undefined) return false;
  if (Object.prototype.toString.call(cause) !== "[object Object]") return false;
  // SAFETY: Verified plain Object before checking isAxiosError property.
  return (cause as Record<string, Jsonish>).isAxiosError === true;
};

export const axiosErrorDebugInfo = (cause: unknown) => {
  if (!isAxiosLikeError(cause)) {
    return normalizeDebugValue(cause);
  }

  return {
    name: cause.name,
    message: cause.message,
    code: cause.code,
    status: cause.response?.status,
    statusText: cause.response?.statusText,
    method: cause.config?.method,
    url: cause.config?.url,
    baseURL: cause.config?.baseURL,
    timeout: cause.config?.timeout,
    requestHeaders: normalizeHeaders(cause.config?.headers),
    responseHeaders: normalizeHeaders(cause.response?.headers),
    responseData: normalizeDebugValue(cause.response?.data),
  };
};

export const responseDebugInfo = (
  response: {
    status?: number;
    statusText?: string;
    ok?: boolean;
    url?: string;
    headers?: Headers | HeaderMap;
  },
  cause?: unknown,
) => ({
  ok: response.ok,
  status: response.status,
  statusText: response.statusText,
  url: response.url,
  headers: normalizeHeaders(response.headers),
  body: normalizeDebugValue(cause),
});

export const parseFaceApiBody = (bodyText: string): Jsonish => {
  if (!bodyText) return null;
  try {
    // SAFETY: Parsed JSON payload is converted to Jsonish format.
    return JSON.parse(bodyText) as Jsonish;
  } catch (error) {
    return {
      rawText: normalizeDebugValue(bodyText),
      parseError: normalizeDebugValue(error),
    };
  }
};
