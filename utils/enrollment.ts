import { getEnrollmentStatus } from "~/utils/bffMobileApi";
import {
  elapsedMs,
  faceApiError,
  faceApiLog,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";

export type EnrollmentStatus =
  | "loading"
  | "enrolled"
  | "not_enrolled"
  | "error";

export interface EnrollmentCheckResult {
  status: EnrollmentStatus;
  error?: string;
  embeddingCount?: number;
}

export async function fetchEnrollmentStatus(): Promise<EnrollmentCheckResult> {
  const startedAt = startFaceApiTimer();
  faceApiLog("enroll-status:start", {
    caller: "fetchEnrollmentStatus",
    source: "bff",
  });

  try {
    const response = await getEnrollmentStatus();
    const result = {
      status: response.status,
      embeddingCount: response.embeddingCount,
    } satisfies EnrollmentCheckResult;

    faceApiLog("enroll-status:response", {
      durationMs: elapsedMs(startedAt),
      result,
    });
    return result;
  } catch (error) {
    faceApiError("enroll-status:failed", {
      durationMs: elapsedMs(startedAt),
      error,
    });
    return {
      status: "error",
      error:
        error instanceof Error
          ? error.message
          : "Gagal memeriksa status wajah di server.",
    };
  }
}
