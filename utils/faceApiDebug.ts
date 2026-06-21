import { isAxiosError } from "axios";
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

const isDevLoggingEnabled = () => typeof __DEV__ !== "undefined" && __DEV__;

const round = (value: number, precision = 3) =>
  Number(value.toFixed(precision));

const summarizeSecret = (value: unknown) => {
  if (value === "[redacted]") return "[redacted]";
  if (typeof value !== "string") return "[redacted]";
  const scheme = value.startsWith("Bearer ") ? "Bearer" : "secret";
  return `[redacted ${scheme}, length=${value.length}]`;
};

const normalizeHeaders = (headers: unknown) => {
  if (!headers || typeof headers !== "object") return undefined;

  const maybeIterableHeaders = headers as {
    forEach?: (callback: (value: string, key: string) => void) => void;
  };
  if (typeof maybeIterableHeaders.forEach === "function") {
    const collected: Record<string, string> = {};
    maybeIterableHeaders.forEach((value, key) => {
      collected[key] = value;
    });
    return normalizeHeaders(collected);
  }

  const maybeJson = headers as { toJSON?: () => unknown };
  const rawHeaders =
    typeof maybeJson.toJSON === "function" ? maybeJson.toJSON() : headers;

  if (!rawHeaders || typeof rawHeaders !== "object") return undefined;

  return Object.fromEntries(
    Object.entries(rawHeaders as Record<string, unknown>).map(
      ([key, value]) => {
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
      },
    ),
  );
};

const normalizeDebugValue = (value: unknown, depth = 0): Jsonish => {
  if (depth > MAX_DEPTH) return "[max-depth]";
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (typeof value === "string") {
    if (value.length <= MAX_STRING_PREVIEW) return value;
    return {
      preview: value.slice(0, MAX_STRING_PREVIEW),
      truncated: true,
      length: value.length,
    };
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeDebugValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
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
    return Object.fromEntries(entries) as Jsonish;
  }

  return String(value);
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
  originalPayload?: unknown,
) => {
  Sentry.withScope((scope) => {
    scope.setTag("feature", "face-api");
    scope.setTag("event", event);
    scope.setLevel(level);
    scope.setContext("face_api", {
      event,
      payload: payload ?? null,
    });

    if (level === "error" && originalPayload instanceof Error) {
      Sentry.captureException(originalPayload);
      return;
    }

    Sentry.captureMessage(`Face API ${level}: ${event}`);
  });
};

export const faceApiLog = (event: string, payload?: unknown) => {
  if (!isDevLoggingEnabled()) return;
  console.log(`${PREFIX} ${event}`, normalizeDebugValue(payload));
};

export const faceApiWarn = (event: string, payload?: unknown) => {
  const normalizedPayload = normalizeDebugValue(payload);
  if (isDevLoggingEnabled()) {
    console.warn(`${PREFIX} ${event}`, normalizedPayload);
    return;
  }

  captureFaceApiProductionEvent("warning", event, normalizedPayload, payload);
};

export const faceApiError = (event: string, payload?: unknown) => {
  const normalizedPayload = normalizeDebugValue(payload);
  if (isDevLoggingEnabled()) {
    console.error(`${PREFIX} ${event}`, normalizedPayload);
    return;
  }

  captureFaceApiProductionEvent("error", event, normalizedPayload, payload);
};

export const sessionDebugInfo = (
  session: {
    access_token?: string | null;
    expires_at?: number | null;
    user?: {
      id?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
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

export const axiosErrorDebugInfo = (error: unknown) => {
  if (!isAxiosError(error)) {
    return normalizeDebugValue(error);
  }

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText,
    method: error.config?.method,
    url: error.config?.url,
    baseURL: error.config?.baseURL,
    timeout: error.config?.timeout,
    requestHeaders: normalizeHeaders(error.config?.headers),
    responseHeaders: normalizeHeaders(error.response?.headers),
    responseData: normalizeDebugValue(error.response?.data),
  };
};

export const responseDebugInfo = (
  response: {
    status?: number;
    statusText?: string;
    ok?: boolean;
    url?: string;
    headers?: Headers | Record<string, unknown>;
  },
  body?: unknown,
) => ({
  ok: response.ok,
  status: response.status,
  statusText: response.statusText,
  url: response.url,
  headers: normalizeHeaders(response.headers),
  body: normalizeDebugValue(body),
});

export const parseFaceApiBody = (bodyText: string) => {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText) as unknown;
  } catch (error) {
    return {
      rawText: normalizeDebugValue(bodyText),
      parseError: normalizeDebugValue(error),
    };
  }
};
