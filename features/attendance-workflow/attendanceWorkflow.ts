import type {
  BffAttendanceAction,
  MobileAttendanceAction,
} from "~/utils/bffMobileApi";

const MAX_BASE64_SIZE_BYTES = 5 * 1024 * 1024;
const DEFAULT_ATTEMPT_TTL_MS = 10 * 60 * 1000;

type AttemptId = string & {
  readonly __attendanceWorkflowAttempt: unique symbol;
};
type AttemptState = "ready" | "submitting" | "submitted" | "cancelled";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type LocationResult = {
  permissionGranted: boolean;
  mocked: boolean;
  coordinates?: Coordinates;
};

export type AttendanceWorkflowErrorCode =
  | "missing_user"
  | "location_unavailable"
  | "precheck_unavailable"
  | "attempt_not_found"
  | "capture_missing"
  | "capture_unreadable"
  | "capture_invalid"
  | "payload_too_large"
  | "fallback_location_unavailable"
  | "fallback_mock_location"
  | "submit_unavailable";

export type PrepareOutcome =
  | {
      status: "ready";
      attemptId: AttemptId;
      precheck: MobileAttendanceAction;
    }
  | {
      status: "blocked";
      reason: "permission_denied" | "mock_location" | "precheck_rejected";
      precheck?: MobileAttendanceAction;
    }
  | { status: "failed"; code: AttendanceWorkflowErrorCode };

export type CompleteOutcome =
  | {
      status: "submitted";
      attendanceType: BffAttendanceAction;
      processingTime: number;
    }
  | {
      status: "failed";
      code: AttendanceWorkflowErrorCode;
      retryable: boolean;
    }
  | {
      status: "cancelled";
      reason: "attempt_cancelled" | "attempt_expired";
    };

export type PendingAttendanceSuccess = {
  attendanceType: BffAttendanceAction;
  processingTime: number;
};

export type AttendanceWorkflowAdapters = {
  location: {
    getCurrentPosition(): Promise<LocationResult>;
  };
  capture: {
    readBase64(snapshotPath: string): Promise<string>;
    cleanup(snapshotPath: string): Promise<void>;
  };
  gateway: {
    precheck(coordinates: Coordinates): Promise<MobileAttendanceAction>;
    submit(input: {
      actionType: BffAttendanceAction;
      imageBase64: string;
      coordinates: Coordinates;
    }): Promise<PendingAttendanceSuccess>;
  };
};

export type AttendanceWorkflow = {
  prepare(input: {
    userId: string | null | undefined;
  }): Promise<PrepareOutcome>;
  complete(input: {
    attemptId: string | null | undefined;
    snapshotPath: string | null | undefined;
  }): Promise<CompleteOutcome>;
  cancel(attemptId: string | null | undefined): void;
  consumeSuccessHandoff(): PendingAttendanceSuccess | null;
};

type Attempt = {
  id: AttemptId;
  userId: string;
  actionType: BffAttendanceAction;
  coordinates?: Coordinates;
  expiresAt: number;
  generation: number;
  state: AttemptState;
  snapshotPath?: string;
  completion?: Promise<CompleteOutcome>;
  submitted?: Extract<CompleteOutcome, { status: "submitted" }>;
};

const isCoordinates = (value: Coordinates | undefined): value is Coordinates =>
  Boolean(
    value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude),
  );

const normalizeBase64 = (value: string): string | null => {
  if (!value || typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value.trim();
};

const base64ByteSize = (base64: string) => {
  const paddingLength = base64.match(/=+$/)?.[0]?.length ?? 0;
  return (base64.length * 3) / 4 - paddingLength;
};

const newAttemptId = (): AttemptId => {
  // SAFETY: The generated value is opaque and only created at this trusted workflow boundary.
  return `attendance-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}` as AttemptId;
};

export const createAttendanceWorkflow = (
  adapters: AttendanceWorkflowAdapters,
  options: { attemptTtlMs?: number; now?: () => number } = {},
): AttendanceWorkflow => {
  const attempts = new Map<AttemptId, Attempt>();
  const activeAttemptByUser = new Map<string, AttemptId>();
  const ttlMs = options.attemptTtlMs ?? DEFAULT_ATTEMPT_TTL_MS;
  const now = options.now ?? Date.now;
  let pendingSuccess: PendingAttendanceSuccess | null = null;

  const cleanup = async (attempt: Attempt) => {
    if (!attempt.snapshotPath) return;
    try {
      await adapters.capture.cleanup(attempt.snapshotPath);
    } catch {
      // Local cleanup must not replace an attendance outcome.
    }
  };

  const cancelAttempt = (attempt: Attempt) => {
    if (attempt.state === "submitted" || attempt.state === "cancelled") return;
    attempt.generation += 1;
    attempt.state = "cancelled";
    void cleanup(attempt);
  };

  const purgeExpired = () => {
    const currentTime = now();
    for (const [attemptId, attempt] of attempts) {
      if (attempt.expiresAt > currentTime) continue;
      cancelAttempt(attempt);
      attempts.delete(attemptId);
      if (activeAttemptByUser.get(attempt.userId) === attemptId) {
        activeAttemptByUser.delete(attempt.userId);
      }
    }
  };

  const isActive = (attempt: Attempt, generation: number) =>
    attempts.get(attempt.id) === attempt &&
    attempt.state !== "cancelled" &&
    attempt.generation === generation &&
    attempt.expiresAt > now();

  const prepare: AttendanceWorkflow["prepare"] = async ({ userId }) => {
    purgeExpired();
    if (!userId) return { status: "failed", code: "missing_user" };

    let location: LocationResult;
    try {
      location = await adapters.location.getCurrentPosition();
    } catch {
      return { status: "failed", code: "location_unavailable" };
    }

    if (!location.permissionGranted) {
      return { status: "blocked", reason: "permission_denied" };
    }
    if (location.mocked) {
      return { status: "blocked", reason: "mock_location" };
    }
    if (!isCoordinates(location.coordinates)) {
      return { status: "failed", code: "location_unavailable" };
    }

    let precheck: MobileAttendanceAction;
    try {
      precheck = await adapters.gateway.precheck(location.coordinates);
    } catch {
      return { status: "failed", code: "precheck_unavailable" };
    }

    if (!precheck.actionable || precheck.action_type === "none") {
      return { status: "blocked", reason: "precheck_rejected", precheck };
    }

    const previousAttemptId = activeAttemptByUser.get(userId);
    if (previousAttemptId) {
      const previousAttempt = attempts.get(previousAttemptId);
      if (previousAttempt) cancelAttempt(previousAttempt);
    }

    const id = newAttemptId();
    attempts.set(id, {
      id,
      userId,
      actionType: precheck.action_type,
      coordinates: location.coordinates,
      expiresAt: now() + ttlMs,
      generation: 0,
      state: "ready",
    });
    activeAttemptByUser.set(userId, id);

    return { status: "ready", attemptId: id, precheck };
  };

  const complete: AttendanceWorkflow["complete"] = async ({
    attemptId,
    snapshotPath,
  }) => {
    purgeExpired();
    if (!attemptId) {
      return { status: "failed", code: "attempt_not_found", retryable: false };
    }

    // SAFETY: Attempt IDs are opaque strings created by this workflow and validated by presence in the map.
    const attempt = attempts.get(attemptId as AttemptId);
    if (!attempt) {
      return { status: "cancelled", reason: "attempt_expired" };
    }
    if (attempt.state === "cancelled") {
      return { status: "cancelled", reason: "attempt_cancelled" };
    }
    if (attempt.submitted) return attempt.submitted;
    if (attempt.completion) return attempt.completion;

    const generation = attempt.generation;
    attempt.snapshotPath = snapshotPath?.trim() || undefined;

    const run = async (): Promise<CompleteOutcome> => {
      let outcome: CompleteOutcome = {
        status: "failed",
        code: "capture_missing",
        retryable: true,
      };

      try {
        if (!attempt.snapshotPath) return outcome;
        if (!isActive(attempt, generation)) {
          return { status: "cancelled", reason: "attempt_cancelled" };
        }

        let rawBase64: string;
        try {
          rawBase64 = await adapters.capture.readBase64(attempt.snapshotPath);
        } catch {
          return {
            status: "failed",
            code: "capture_unreadable",
            retryable: true,
          };
        }

        if (!isActive(attempt, generation)) {
          return { status: "cancelled", reason: "attempt_cancelled" };
        }

        const compactBase64 = rawBase64
          .replace(/^data:[^;,]+;base64,/i, "")
          .replace(/\s/g, "");
        if (base64ByteSize(compactBase64) > MAX_BASE64_SIZE_BYTES) {
          return {
            status: "failed",
            code: "payload_too_large",
            retryable: true,
          };
        }

        const imageBase64 = normalizeBase64(compactBase64);
        if (!imageBase64) {
          return { status: "failed", code: "capture_invalid", retryable: true };
        }

        let coordinates = attempt.coordinates;
        if (!isCoordinates(coordinates)) {
          let fallbackLocation: LocationResult;
          try {
            fallbackLocation = await adapters.location.getCurrentPosition();
          } catch {
            return {
              status: "failed",
              code: "fallback_location_unavailable",
              retryable: true,
            };
          }
          if (
            !fallbackLocation.permissionGranted ||
            !isCoordinates(fallbackLocation.coordinates)
          ) {
            return {
              status: "failed",
              code: "fallback_location_unavailable",
              retryable: true,
            };
          }
          if (fallbackLocation.mocked) {
            return {
              status: "failed",
              code: "fallback_mock_location",
              retryable: true,
            };
          }
          coordinates = fallbackLocation.coordinates;
        }

        if (!isActive(attempt, generation)) {
          return { status: "cancelled", reason: "attempt_cancelled" };
        }

        attempt.state = "submitting";
        let success: PendingAttendanceSuccess;
        try {
          success = await adapters.gateway.submit({
            actionType: attempt.actionType,
            imageBase64,
            coordinates,
          });
        } catch {
          return {
            status: "failed",
            code: "submit_unavailable",
            retryable: true,
          };
        }

        if (!isActive(attempt, generation)) {
          return { status: "cancelled", reason: "attempt_cancelled" };
        }

        outcome = {
          status: "submitted",
          attendanceType: success.attendanceType,
          processingTime: success.processingTime,
        };
        attempt.submitted = outcome;
        attempt.state = "submitted";
        pendingSuccess = success;
        return outcome;
      } finally {
        await cleanup(attempt);
        if (attempt.state === "submitting") attempt.state = "ready";
        if (attempt.state === "ready") attempt.completion = undefined;
      }
    };

    attempt.completion = run();
    return attempt.completion;
  };

  return {
    prepare,
    complete,
    cancel: (attemptId) => {
      if (!attemptId) return;
      // SAFETY: Attempt IDs are opaque strings created by this workflow and validated by presence in the map.
      const attempt = attempts.get(attemptId as AttemptId);
      if (attempt) cancelAttempt(attempt);
    },
    consumeSuccessHandoff: () => {
      const success = pendingSuccess;
      pendingSuccess = null;
      return success;
    },
  };
};
