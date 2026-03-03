import axios, { isAxiosError } from "axios";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { ensureFaceApiConfigured } from "~/utils/secureConfig";

export type EnrollmentStatus =
  | "loading"
  | "enrolled"
  | "not_enrolled"
  | "error";

export interface EnrollmentCheckResult {
  status: EnrollmentStatus;
  error?: string;
}

/**
 * Checks the face recognition enrollment status for the currently
 * authenticated user by calling the Face API.
 */
export async function fetchEnrollmentStatus(): Promise<EnrollmentCheckResult> {
  try {
    await ensureSupabaseInitialized();
    const faceApiBaseUrl = await ensureFaceApiConfigured();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return { status: "error", error: "Sesi tidak valid" };
    }

    const response = await axios.get(`${faceApiBaseUrl}/v1/enroll/status`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
    });

    return {
      status: response.data.is_enrolled ? "enrolled" : "not_enrolled",
    };
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return { status: "not_enrolled" };
    }
    if (__DEV__)
      console.error("[enrollment] fetchEnrollmentStatus failed:", error);
    return { status: "error", error: "Gagal terhubung ke server" };
  }
}
