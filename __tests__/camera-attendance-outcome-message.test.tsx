import * as React from "react";
import { Alert } from "react-native";
import { mockRouter } from "../__mocks__/expo-router";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockTakeSnapshot = jest.fn();
const mockCompleteAttendance = jest.fn();

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("react-native-vision-camera", () => {
  const React = require("react");
  return {
    Camera: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        takeSnapshot: mockTakeSnapshot,
      }));
      React.useEffect(() => props.onInitialized?.(), [props.onInitialized]);
      return null;
    }),
    useCameraDevice: () => ({ id: "front-camera" }),
    useCameraPermission: () => ({
      hasPermission: true,
      requestPermission: jest.fn(),
    }),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/features/attendance-workflow", () => ({
  completeAttendance: mockCompleteAttendance,
  cancelAttendance: jest.fn(),
}));

describe("CameraAttendance submit outcome guidance", () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("shows check-history guidance when the submit outcome is unknown", async () => {
    const expoRouter = require("expo-router");
    jest
      .spyOn(expoRouter, "useLocalSearchParams")
      .mockReturnValue({ attemptId: "attendance-test" });
    const alert = jest.spyOn(Alert, "alert").mockImplementation();
    mockTakeSnapshot.mockResolvedValueOnce({ path: "/cache/attendance.jpg" });
    mockCompleteAttendance.mockResolvedValueOnce({
      status: "failed",
      code: "submit_outcome_unknown",
      retryable: false,
      message:
        "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi.",
    });

    const CameraAttendance =
      require("../app/attendance/CameraAttendance").default;
    const view = await render(<CameraAttendance />);
    await act(async () => {
      await fireEvent.press(view.getByLabelText("Ambil foto presensi"));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        "Hasil Presensi Belum Diketahui",
        "Presensi belum dapat dipastikan. Periksa riwayat presensi sebelum mencoba lagi.",
        [{ text: "Periksa Riwayat", onPress: expect.any(Function) }],
        { cancelable: false },
      ),
    );
    const buttons = alert.mock.calls[0]?.[2];
    await act(async () => {
      buttons?.[0]?.onPress?.();
    });
    expect(mockRouter.replace).toHaveBeenCalledWith("/extra/riwayat");
    expect(mockCompleteAttendance).toHaveBeenCalledTimes(1);
    expect(mockCompleteAttendance).toHaveBeenCalledWith({
      attemptId: "attendance-test",
      snapshotPath: "/cache/attendance.jpg",
    });
  });
});
