import axios, { isAxiosError } from "axios";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { ensureFaceApiConfigured } from "~/utils/secureConfig";
import {
  axiosErrorDebugInfo,
  elapsedMs,
  faceApiError,
  faceApiLog,
  faceApiWarn,
  sessionDebugInfo,
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
}

interface EnrollmentStatusResponse {
  is_enrolled: boolean;
  embedding_count?: number;
  user_id?: string;
}

/**
 * Checks the face recognition enrollment status for the currently
 * authenticated user by calling the Face API.
 */
export async function fetchEnrollmentStatus(): Promise<EnrollmentCheckResult> {
  const startedAt = startFaceApiTimer();
  faceApiLog("enroll-status:start", {
    caller: "fetchEnrollmentStatus",
  });

  try {
    await ensureSupabaseInitialized();
    const faceApiBaseUrl = await ensureFaceApiConfigured();
    const enrollStatusUrl = `${faceApiBaseUrl}/v1/enroll/status`;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    faceApiLog("enroll-status:session", sessionDebugInfo(session));

    if (!session) {
      faceApiWarn("enroll-status:missing-session", {
        durationMs: elapsedMs(startedAt),
      });
      return { status: "error", error: "Sesi tidak valid" };
    }

    faceApiLog("enroll-status:request", {
      method: "GET",
      url: enrollStatusUrl,
      headers: {
        Authorization: "[redacted bearer]",
        Accept: "application/json",
      },
    });

    const response = await axios.get<EnrollmentStatusResponse>(
      enrollStatusUrl,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: "application/json",
        },
      },
    );

    faceApiLog("enroll-status:response", {
      status: response.status,
      statusText: response.statusText,
      durationMs: elapsedMs(startedAt),
      data: response.data,
    });

    return {
      status: response.data.is_enrolled ? "enrolled" : "not_enrolled",
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      faceApiWarn("enroll-status:not-found", {
        durationMs: elapsedMs(startedAt),
        error: axiosErrorDebugInfo(error),
      });
      return { status: "not_enrolled" };
    }
    faceApiError("enroll-status:failed", {
      durationMs: elapsedMs(startedAt),
      error: axiosErrorDebugInfo(error),
    });
    return { status: "error", error: "Gagal terhubung ke server" };
  }
}
