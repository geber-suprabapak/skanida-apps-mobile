import { ensureFaceApiConfigured } from "~/utils/secureConfig";
import {
  elapsedMs,
  faceApiError,
  faceApiLog,
  parseFaceApiBody,
  responseDebugInfo,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";

const FACE_API_RUNTIME_TIMEOUT_MS = 10_000;

type JsonRecord = Record<string, unknown>;

export interface FaceApiRootInfo {
  service?: string;
  version?: string;
  status?: string;
  gpu_enabled?: string | boolean;
  docs?: string;
}

export interface FaceApiLivenessInfo {
  status?: string;
}

export interface FaceApiReadinessInfo {
  status: string;
  model_loaded: boolean;
  face_detector_ready: boolean;
  gpu_available: boolean;
  supabase_connected: boolean;
  qdrant_connected: boolean;
}

export interface FaceApiRuntimeInfo {
  baseUrl: string;
  root: FaceApiRootInfo | null;
  live: FaceApiLivenessInfo | null;
  readiness: FaceApiReadinessInfo | null;
  readinessPath: "/ready" | "/health" | null;
}

export type FaceApiRuntimeState =
  | "healthy"
  | "unhealthy"
  | "offline"
  | "misconfigured";

export interface FaceApiRuntimeStatusResult {
  state: FaceApiRuntimeState;
  title: string;
  message: string;
  issues: string[];
  info?: FaceApiRuntimeInfo;
  error?: string;
}

type FaceApiJsonResponse = {
  ok: boolean;
  status: number;
  path: string;
  body: unknown;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getErrorMessage = (
  error: unknown,
  fallback = "Terjadi kesalahan saat menghubungi server.",
) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return false;
};

const parseRootInfo = (value: unknown): FaceApiRootInfo | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    service: typeof value.service === "string" ? value.service : undefined,
    version: typeof value.version === "string" ? value.version : undefined,
    status: typeof value.status === "string" ? value.status : undefined,
    gpu_enabled:
      typeof value.gpu_enabled === "boolean" ||
      typeof value.gpu_enabled === "string"
        ? value.gpu_enabled
        : undefined,
    docs: typeof value.docs === "string" ? value.docs : undefined,
  };
};

const parseLivenessInfo = (value: unknown): FaceApiLivenessInfo | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    status: typeof value.status === "string" ? value.status : undefined,
  };
};

const parseReadinessInfo = (value: unknown): FaceApiReadinessInfo | null => {
  if (!isRecord(value) || typeof value.status !== "string") {
    return null;
  }

  return {
    status: value.status,
    model_loaded: normalizeBoolean(value.model_loaded),
    face_detector_ready: normalizeBoolean(value.face_detector_ready),
    gpu_available: normalizeBoolean(value.gpu_available),
    supabase_connected: normalizeBoolean(value.supabase_connected),
    qdrant_connected: normalizeBoolean(value.qdrant_connected),
  };
};

const fetchFaceApiJson = async (
  baseUrl: string,
  path: string,
  logPrefix: string,
): Promise<FaceApiJsonResponse> => {
  const startedAt = startFaceApiTimer();
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    FACE_API_RUNTIME_TIMEOUT_MS,
  );
  const url = `${baseUrl}${path}`;

  try {
    faceApiLog(`${logPrefix}:request`, {
      method: "GET",
      url,
      timeoutMs: FACE_API_RUNTIME_TIMEOUT_MS,
      headers: {
        Accept: "application/json",
      },
    });

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const parsedBody = parseFaceApiBody(bodyText);

    faceApiLog(`${logPrefix}:response`, {
      durationMs: elapsedMs(startedAt),
      ...responseDebugInfo(response, parsedBody),
    });

    return {
      ok: response.ok,
      status: response.status,
      path,
      body: parsedBody,
    };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      faceApiError(`${logPrefix}:timeout`, {
        durationMs: elapsedMs(startedAt),
        timeoutMs: FACE_API_RUNTIME_TIMEOUT_MS,
        error,
      });
      throw new Error(
        "Permintaan status server melebihi batas waktu. Silakan coba lagi.",
      );
    }

    faceApiError(`${logPrefix}:failed`, {
      durationMs: elapsedMs(startedAt),
      error,
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getFaceApiIssues = (readiness: FaceApiReadinessInfo | null) => {
  if (!readiness) {
    return ["Status server tidak valid."];
  }

  const issues: string[] = [];

  if (!readiness.model_loaded) {
    issues.push("Model wajah belum dimuat");
  }

  if (!readiness.face_detector_ready) {
    issues.push("Face detector belum siap");
  }

  if (!readiness.supabase_connected) {
    issues.push("Koneksi Supabase bermasalah");
  }

  if (!readiness.qdrant_connected) {
    issues.push("Koneksi Qdrant bermasalah");
  }

  return issues;
};

export async function fetchFaceApiRuntimeStatus(): Promise<FaceApiRuntimeStatusResult> {
  const startedAt = startFaceApiTimer();
  let baseUrl: string;

  try {
    baseUrl = await ensureFaceApiConfigured();
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Server verifikasi belum dikonfigurasi. Hubungi administrator.",
    );

    faceApiError("runtime-status:misconfigured", {
      durationMs: elapsedMs(startedAt),
      error,
      message,
    });

    return {
      state: "misconfigured",
      title: "Server belum dikonfigurasi",
      message: "Server verifikasi belum dikonfigurasi.",
      issues: [],
      error: message,
    };
  }

  faceApiLog("runtime-status:start", { baseUrl });

  const [rootResult, liveResult] = await Promise.allSettled([
    fetchFaceApiJson(baseUrl, "/", "runtime-root"),
    fetchFaceApiJson(baseUrl, "/live", "runtime-live"),
  ]);

  let readinessResult: FaceApiJsonResponse | null = null;

  try {
    readinessResult = await fetchFaceApiJson(baseUrl, "/ready", "runtime-ready");
    if (readinessResult.status === 404) {
      readinessResult = await fetchFaceApiJson(
        baseUrl,
        "/health",
        "runtime-health",
      );
      readinessResult.path = "/health";
    }
  } catch (error) {
    const message = getErrorMessage(
      error,
      "Tidak dapat menghubungi server. Periksa koneksi jaringan.",
    );

    return {
      state: "offline",
      title: "Server tidak terhubung",
      message: "Server verifikasi tidak dapat dihubungi.",
      issues: [],
      info: {
        baseUrl,
        root:
          rootResult.status === "fulfilled"
            ? parseRootInfo(rootResult.value.body)
            : null,
        live:
          liveResult.status === "fulfilled"
            ? parseLivenessInfo(liveResult.value.body)
            : null,
        readiness: null,
        readinessPath: null,
      },
      error: message,
    };
  }

  const root =
    rootResult.status === "fulfilled" ? parseRootInfo(rootResult.value.body) : null;
  const live =
    liveResult.status === "fulfilled"
      ? parseLivenessInfo(liveResult.value.body)
      : null;
  const readiness = parseReadinessInfo(readinessResult.body);
  const info: FaceApiRuntimeInfo = {
    baseUrl,
    root,
    live,
    readiness,
    readinessPath:
      readinessResult.path === "/health" ? "/health" : "/ready",
  };

  if (!live || live.status !== "alive") {
    return {
      state: "offline",
      title: "Server tidak merespons normal",
      message:
        "Server verifikasi belum dapat digunakan saat ini.",
      issues: [],
      info,
      error: "Endpoint /live tidak merespons status alive.",
    };
  }

  if (!readiness) {
    return {
      state: "unhealthy",
      title: "Status server tidak valid",
      message:
        "Status server verifikasi belum dapat dibaca.",
      issues: ["Respons readiness tidak valid."],
      info,
      error: "Respons readiness tidak valid.",
    };
  }

  const issues = getFaceApiIssues(readiness);
  const isHealthy =
    readiness.status === "healthy" && issues.length === 0 && readinessResult.ok;

  const result: FaceApiRuntimeStatusResult = isHealthy
    ? {
        state: "healthy",
        title: "Server siap digunakan",
        message: "Layanan verifikasi wajah siap digunakan.",
        issues,
        info,
      }
    : {
        state: "unhealthy",
        title: "Server belum siap",
        message: "Server verifikasi sedang belum siap. Silakan coba lagi.",
        issues,
        info,
        error: issues.join(". "),
      };

  faceApiLog("runtime-status:result", {
    durationMs: elapsedMs(startedAt),
    result,
  });

  return result;
}

export async function ensureFaceApiReady() {
  const runtime = await fetchFaceApiRuntimeStatus();
  if (runtime.state !== "healthy") {
    throw new Error(runtime.message);
  }
  return runtime;
}
