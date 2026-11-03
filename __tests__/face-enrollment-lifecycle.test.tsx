import * as React from "react";
import { Alert, BackHandler } from "react-native";
import type { HardwareBackPressEvent } from "react-native/Libraries/Utilities/BackHandler";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import FaceEnrollment from "../app/profile/enroll";
import * as FileSystem from "expo-file-system/legacy";
import { mockRouter } from "../__mocks__/expo-router";
import { getEnrollmentStatus, submitEnrollment } from "../utils/bffMobileApi";
import { fetchFaceApiRuntimeStatus } from "../utils/faceApiRuntime";

const mockTakeSnapshot = jest.fn();

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("react-native-vision-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Camera: React.forwardRef(
      (
        props: { onInitialized?: () => void },
        ref: React.ForwardedRef<{ takeSnapshot: typeof mockTakeSnapshot }>,
      ) => {
        React.useImperativeHandle(ref, () => ({
          takeSnapshot: mockTakeSnapshot,
        }));
        React.useEffect(() => props.onInitialized?.(), [props.onInitialized]);
        return React.createElement(View, { testID: "mock-camera" });
      },
    ),
    useCameraDevice: () => ({ id: "front-camera", position: "front" }),
    useCameraPermission: () => ({
      hasPermission: true,
      requestPermission: jest.fn(),
    }),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("../__mocks__/react-native-reanimated.js");
  return { ...actual, FadeIn: { duration: jest.fn(() => ({})) } };
});

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: jest.fn(async () => ({ exists: true, size: 128 })),
  deleteAsync: jest.fn(async () => {}),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/bffMobileApi", () => ({
  submitEnrollment: jest.fn(),
  getEnrollmentStatus: jest.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/faceApiRuntime", () => ({
  fetchFaceApiRuntimeStatus: jest.fn(async () => ({
    state: "healthy",
    title: "Server siap",
    message: "Layanan siap",
    issues: [],
  })),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/faceApiDebug", () => ({
  bytesInfo: (bytes: number) => ({
    bytes,
    kb: bytes / 1024,
    mb: bytes / 1048576,
  }),
  elapsedMs: () => 1,
  faceApiError: jest.fn(),
  faceApiLog: jest.fn(),
  faceApiWarn: jest.fn(),
  startFaceApiTimer: () => 0,
}));

const enrollmentRequest = jest.mocked(submitEnrollment);
const fileSystem = jest.mocked(FileSystem);
const runtimeStatus = jest.mocked(fetchFaceApiRuntimeStatus);

const successResult = {
  imagesProcessed: 10,
  imagesFailed: 0,
  totalEmbeddings: 10,
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

let backHandler:
  | ((event: HardwareBackPressEvent) => boolean | null | undefined)
  | undefined;
const confirmNativeAlert = () =>
  jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.text === "Ya, Batalkan")?.onPress?.();
  });

const captureTenPhotos = async () => {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ambil foto wajah"));
    });
  }
  await screen.findByText("10 Foto Berhasil Diambil");
};

const startUpload = async () => {
  await act(async () => {
    fireEvent.press(screen.getByText("Lanjutkan Enrollment"));
  });
  await waitFor(() => expect(enrollmentRequest).toHaveBeenCalledTimes(1));
};

const pressBackAndConfirm = async () => {
  confirmNativeAlert();
  await act(async () => {
    backHandler?.({ type: "hardwareBackPress", timeStamp: 0 });
  });
};

describe("Face Enrollment request lifecycle", () => {
  beforeEach(() => {
    backHandler = undefined;
    mockRouter.back.mockClear();
    mockTakeSnapshot
      .mockReset()
      .mockResolvedValue({ path: "/tmp/synthetic.jpg" });
    enrollmentRequest.mockReset();
    jest.mocked(getEnrollmentStatus).mockReset();
    jest.mocked(getEnrollmentStatus).mockResolvedValue({
      status: "not_enrolled",
      embeddingCount: 0,
      message: "",
    });
    fileSystem.deleteAsync.mockClear();
    fileSystem.getInfoAsync.mockClear();
    runtimeStatus.mockClear();
    runtimeStatus.mockResolvedValue({
      state: "healthy",
      title: "Server siap",
      message: "Layanan siap",
      issues: [],
    });
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_name, handler) => {
        backHandler = handler;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("captures ten photos, reports success, and removes local captures", async () => {
    enrollmentRequest.mockResolvedValue(successResult);
    await render(<FaceEnrollment />);
    await captureTenPhotos();
    await startUpload();

    expect(await screen.findByText("Enrollment Berhasil!")).toBeTruthy();
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(10),
    );
  });

  it("cleans captures when cancellation happens before upload", async () => {
    await render(<FaceEnrollment />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ambil foto wajah"));
    });
    await pressBackAndConfirm();

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(enrollmentRequest).not.toHaveBeenCalled();
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      "file:///tmp/synthetic.jpg",
      { idempotent: true },
    );
  });

  it.each(["resolve", "reject"] as const)(
    "aborts during upload and ignores a late %s result",
    async (lateResult) => {
      const request = deferred<typeof successResult>();
      enrollmentRequest.mockReturnValue(request.promise);
      await render(<FaceEnrollment />);
      await captureTenPhotos();
      await startUpload();
      const signal = enrollmentRequest.mock.calls[0]?.[1];

      await pressBackAndConfirm();

      expect(signal?.aborted).toBe(true);
      expect(await screen.findByText("Pengiriman Dihentikan")).toBeTruthy();
      expect(
        screen.getByText(
          /server mungkin sudah menerima sebagian atau seluruh proses/i,
        ),
      ).toBeTruthy();

      await act(async () => {
        if (lateResult === "resolve") request.resolve(successResult);
        else request.reject(new Error("late failure"));
      });

      expect(screen.queryByText("Enrollment Berhasil!")).toBeNull();
      expect(screen.queryByText("Enrollment Gagal")).toBeNull();
      await waitFor(() =>
        expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(10),
      );
    },
  );

  it("cleans captured files on unmount", async () => {
    const view = await render(<FaceEnrollment />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Ambil foto wajah"));
    });

    await act(async () => {
      view.unmount();
    });

    await waitFor(() =>
      expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(1),
    );
  });

  it("aborts an active upload and cleans captures on unmount", async () => {
    const request = deferred<typeof successResult>();
    enrollmentRequest.mockReturnValue(request.promise);
    const view = await render(<FaceEnrollment />);
    await captureTenPhotos();
    await startUpload();
    const signal = enrollmentRequest.mock.calls[0]?.[1];

    await act(async () => {
      view.unmount();
    });
    expect(signal?.aborted).toBe(true);

    await act(async () => {
      request.reject(new Error("synthetic abort"));
    });
    await waitFor(() =>
      expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
        "file:///tmp/synthetic.jpg",
        { idempotent: true },
      ),
    );
  });

  it("does not offer upload replay after an ambiguous POST failure", async () => {
    enrollmentRequest.mockRejectedValue(new Error("synthetic failure"));
    await render(<FaceEnrollment />);
    await captureTenPhotos();
    await startUpload();

    expect(
      await screen.findByText("Hasil Pendaftaran Belum Diketahui"),
    ).toBeTruthy();
    expect(screen.queryByText("Coba Lagi")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByText("Periksa Status Pendaftaran"));
    });
    expect(
      await screen.findByText(/Proses sebelumnya mungkin masih berjalan/),
    ).toBeTruthy();
    expect(enrollmentRequest).toHaveBeenCalledTimes(1);
    expect(fileSystem.deleteAsync).toHaveBeenCalledTimes(10);
  });
  it.each(["enrolled", "failure"] as const)(
    "checks status after cancellation: %s without resending",
    async (result) => {
      const request = deferred<typeof successResult>();
      enrollmentRequest.mockReturnValue(request.promise);
      if (result === "enrolled")
        jest.mocked(getEnrollmentStatus).mockResolvedValue({
          status: "enrolled",
          embeddingCount: 10,
          message: "",
        });
      else
        jest
          .mocked(getEnrollmentStatus)
          .mockRejectedValue(new Error("offline"));
      await render(<FaceEnrollment />);
      await captureTenPhotos();
      await startUpload();
      await pressBackAndConfirm();
      await act(async () => {
        fireEvent.press(screen.getByText("Periksa Status Pendaftaran"));
      });
      expect(
        await screen.findByText(
          result === "enrolled"
            ? /Status wajah saat ini: terdaftar/
            : /Status belum dapat diperiksa/,
        ),
      ).toBeTruthy();
      expect(screen.queryByText("Enrollment Berhasil!")).toBeNull();
      expect(enrollmentRequest).toHaveBeenCalledTimes(1);
      await act(async () => request.resolve(successResult));
    },
  );
});
