import {
  createUpayaPresensi,
  type LocationResult,
  type Coordinates,
  type PendingAttendanceSuccess,
  type UpayaPresensiWorkflow,
} from "~/features/upaya-presensi/upayaPresensi";
import type {
  BffAttendanceAction,
  MobileAttendanceAction,
} from "~/utils/bffMobileApi";

const coordinates = { latitude: -7.4503, longitude: 110.2241 };
const actionablePrecheck = {
  actionable: true,
  action_type: "check_in" as const,
  message: "Silakan presensi.",
};

type TestAdapters = {
  location: {
    getCurrentPosition: jest.Mock<Promise<LocationResult>, []>;
  };
  capture: {
    readBase64: jest.Mock<Promise<string>, [string]>;
    cleanup: jest.Mock<Promise<void>, [string]>;
  };
  gateway: {
    precheck: jest.Mock<Promise<MobileAttendanceAction>, [Coordinates]>;
    submit: jest.Mock<
      Promise<PendingAttendanceSuccess>,
      [
        {
          actionType: BffAttendanceAction;
          imageBase64: string;
          coordinates: Coordinates;
        },
      ]
    >;
  };
};

const createAdapters = (): TestAdapters => ({
  location: {
    getCurrentPosition: jest
      .fn<Promise<LocationResult>, []>()
      .mockResolvedValue({
        permissionGranted: true,
        mocked: false,
        coordinates,
      }),
  },
  capture: {
    readBase64: jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValue("aGVsbG8="),
    cleanup: jest.fn<Promise<void>, [string]>().mockResolvedValue(),
  },
  gateway: {
    precheck: jest.fn().mockResolvedValue(actionablePrecheck),
    submit: jest.fn().mockResolvedValue({
      attendanceType: "check_in",
      processingTime: 120,
    }),
  },
});

const prepareReadyAttempt = async (workflow: UpayaPresensiWorkflow) => {
  const outcome = await workflow.prepare({ userId: "student-1" });
  expect(outcome.status).toBe("ready");
  if (outcome.status !== "ready") throw new Error("Expected ready outcome");
  return outcome.attemptId;
};

describe("Upaya Presensi contract", () => {
  it("blocks denied permission and mocked positions before precheck", async () => {
    const deniedAdapters = createAdapters();
    deniedAdapters.location.getCurrentPosition.mockResolvedValue({
      permissionGranted: false,
      mocked: false,
    });
    const denied = await createUpayaPresensi(deniedAdapters).prepare({
      userId: "student-1",
    });

    expect(denied).toEqual({ status: "blocked", reason: "permission_denied" });
    expect(deniedAdapters.gateway.precheck).not.toHaveBeenCalled();

    const mockedAdapters = createAdapters();
    mockedAdapters.location.getCurrentPosition.mockResolvedValue({
      permissionGranted: true,
      mocked: true,
      coordinates,
    });
    const mocked = await createUpayaPresensi(mockedAdapters).prepare({
      userId: "student-1",
    });

    expect(mocked).toEqual({ status: "blocked", reason: "mock_location" });
    expect(mockedAdapters.gateway.precheck).not.toHaveBeenCalled();
  });

  it("keeps non-actionable precheck outside camera flow", async () => {
    const adapters = createAdapters();
    adapters.gateway.precheck.mockResolvedValue({
      actionable: false,
      action_type: "none",
      message: "Presensi belum tersedia.",
    });
    const workflow = createUpayaPresensi(adapters);

    await expect(workflow.prepare({ userId: "student-1" })).resolves.toEqual({
      status: "blocked",
      reason: "precheck_rejected",
      precheck: {
        actionable: false,
        action_type: "none",
        message: "Presensi belum tersedia.",
      },
    });
    expect(adapters.capture.readBase64).not.toHaveBeenCalled();
    expect(adapters.gateway.precheck).toHaveBeenCalledWith(coordinates);
  });

  it("submits one valid capture, cleans it, and hands success off once", async () => {
    const adapters = createAdapters();
    const workflow = createUpayaPresensi(adapters);
    const attemptId = await prepareReadyAttempt(workflow);

    await expect(
      workflow.complete({ attemptId, snapshotPath: "/cache/photo.jpg" }),
    ).resolves.toEqual({
      status: "submitted",
      attendanceType: "check_in",
      processingTime: 120,
    });
    expect(adapters.gateway.submit).toHaveBeenCalledWith({
      actionType: "check_in",
      imageBase64: "aGVsbG8=",
      coordinates,
    });
    expect(adapters.capture.cleanup).toHaveBeenCalledWith("/cache/photo.jpg");
    expect(workflow.consumeSuccessHandoff()).toEqual({
      attendanceType: "check_in",
      processingTime: 120,
    });
    expect(workflow.consumeSuccessHandoff()).toBeNull();
  });

  it.each([
    ["missing", undefined, "capture_missing"],
    ["malformed", "/cache/malformed.jpg", "capture_invalid"],
    ["oversized", "/cache/oversized.jpg", "payload_too_large"],
  ])("rejects %s capture before submit", async (_, snapshotPath, code) => {
    const adapters = createAdapters();
    if (code === "capture_invalid") {
      adapters.capture.readBase64.mockResolvedValue("not-base64!");
    }
    if (code === "payload_too_large") {
      adapters.capture.readBase64.mockResolvedValue(
        "A".repeat(7 * 1024 * 1024),
      );
    }
    const workflow = createUpayaPresensi(adapters);
    const attemptId = await prepareReadyAttempt(workflow);

    await expect(
      workflow.complete({ attemptId, snapshotPath }),
    ).resolves.toMatchObject({
      status: "failed",
      code,
      retryable: true,
    });
    expect(adapters.gateway.submit).not.toHaveBeenCalled();
    if (snapshotPath) {
      expect(adapters.capture.cleanup).toHaveBeenCalledWith(snapshotPath);
    }
  });

  it("allows a fresh capture after submit failure without automatic retry", async () => {
    const adapters = createAdapters();
    adapters.gateway.submit
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        attendanceType: "check_in",
        processingTime: 80,
      });
    const workflow = createUpayaPresensi(adapters);
    const attemptId = await prepareReadyAttempt(workflow);

    await expect(
      workflow.complete({ attemptId, snapshotPath: "/cache/first.jpg" }),
    ).resolves.toMatchObject({
      status: "failed",
      code: "submit_unavailable",
      retryable: true,
    });
    expect(adapters.gateway.submit).toHaveBeenCalledTimes(1);

    await expect(
      workflow.complete({ attemptId, snapshotPath: "/cache/second.jpg" }),
    ).resolves.toMatchObject({ status: "submitted" });
    expect(adapters.gateway.submit).toHaveBeenCalledTimes(2);
    expect(adapters.capture.cleanup).toHaveBeenCalledWith("/cache/first.jpg");
    expect(adapters.capture.cleanup).toHaveBeenCalledWith("/cache/second.jpg");
  });

  it("single-flights duplicate completion and ignores a cancelled late result", async () => {
    const adapters = createAdapters();
    const submit = Promise.withResolvers<PendingAttendanceSuccess>();
    adapters.gateway.submit.mockReturnValue(submit.promise);
    const workflow = createUpayaPresensi(adapters);
    const attemptId = await prepareReadyAttempt(workflow);

    const first = workflow.complete({
      attemptId,
      snapshotPath: "/cache/photo.jpg",
    });
    const second = workflow.complete({
      attemptId,
      snapshotPath: "/cache/photo.jpg",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(adapters.gateway.submit).toHaveBeenCalledTimes(1);

    workflow.cancel(attemptId);
    submit.resolve({ attendanceType: "check_in", processingTime: 50 });

    await expect(first).resolves.toEqual({
      status: "cancelled",
      reason: "attempt_cancelled",
    });
    await expect(second).resolves.toEqual({
      status: "cancelled",
      reason: "attempt_cancelled",
    });
    expect(workflow.consumeSuccessHandoff()).toBeNull();
    expect(adapters.capture.cleanup).toHaveBeenCalledWith("/cache/photo.jpg");
  });

  it("expires opaque attempts and keeps a successful result successful when cleanup fails", async () => {
    let currentTime = 1_000;
    const adapters = createAdapters();
    const workflow = createUpayaPresensi(adapters, {
      attemptTtlMs: 100,
      now: () => currentTime,
    });
    const expiredAttemptId = await prepareReadyAttempt(workflow);
    currentTime += 101;

    await expect(
      workflow.complete({
        attemptId: expiredAttemptId,
        snapshotPath: "/cache/expired.jpg",
      }),
    ).resolves.toEqual({ status: "cancelled", reason: "attempt_expired" });

    const activeAttemptId = await prepareReadyAttempt(workflow);
    adapters.capture.cleanup.mockRejectedValueOnce(new Error("disk"));
    await expect(
      workflow.complete({
        attemptId: activeAttemptId,
        snapshotPath: "/cache/success.jpg",
      }),
    ).resolves.toMatchObject({ status: "submitted" });
  });
});
