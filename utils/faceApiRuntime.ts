import { getMobileHealth } from "~/utils/bffMobileApi";
import {
  elapsedMs,
  faceApiError,
  faceApiLog,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";

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

const healthyResult = (): FaceApiRuntimeStatusResult => ({
  state: "healthy",
  title: "Server siap digunakan",
  message: "Layanan verifikasi siap digunakan.",
  issues: [],
});

const unhealthyResult = (message?: string): FaceApiRuntimeStatusResult => ({
  state: "unhealthy",
  title: "Server belum siap",
  message: "Server verifikasi sedang belum siap. Silakan coba lagi.",
  issues: message ? [message] : [],
  error: message,
});

export async function fetchFaceApiRuntimeStatus(): Promise<FaceApiRuntimeStatusResult> {
  const startedAt = startFaceApiTimer();
  faceApiLog("runtime-status:start", { source: "bff" });

  try {
    const result = await getMobileHealth();
    const runtime = result.operational
      ? healthyResult()
      : unhealthyResult("Server aplikasi belum operasional.");

    faceApiLog("runtime-status:result", {
      durationMs: elapsedMs(startedAt),
      result: runtime,
    });
    return runtime;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Server verifikasi tidak dapat dihubungi.";
    const runtime: FaceApiRuntimeStatusResult = {
      state: "offline",
      title: "Server tidak terhubung",
      message: "Server verifikasi tidak dapat dihubungi.",
      issues: [],
      error: message,
    };

    faceApiError("runtime-status:failed", {
      durationMs: elapsedMs(startedAt),
      error,
    });
    return runtime;
  }
}

export async function ensureFaceApiReady() {
  const runtime = await fetchFaceApiRuntimeStatus();
  if (runtime.state !== "healthy") {
    throw new Error(runtime.message);
  }
  return runtime;
}
