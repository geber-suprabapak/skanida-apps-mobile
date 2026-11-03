import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import * as api from "~/utils/bffMobileApi";
import StatusPerizinanScreen from "../app/perizinan/status";
import Riwayat from "../app/extra/riwayat";

let mockFocusCallbacks: (() => void)[] = [];
let mockCalendarUpdate: (data: any) => void = () => {};

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/store/authStore", () => ({
  __esModule: true,
  default: (selector: any) =>
    selector({ user: { id: "synthetic" }, userProfile: null }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-router", () => {
  const React = require("react");
  const actual = jest.requireActual("../__mocks__/expo-router");
  return {
    ...actual,
    useFocusEffect: (callback: () => void) =>
      React.useEffect(() => {
        mockFocusCallbacks.push(callback);
        return callback();
      }, [callback]),
  };
});

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/components/ui/attendance-calendar", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef(({ onDataLoaded }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ refetch: async () => {} }));
      React.useEffect(() => {
        mockCalendarUpdate = onDataLoaded;
        onDataLoaded({
          "2026-10-01": {
            id: "synthetic",
            date: "2026-10-01",
            status: "absent",
          },
        });
      }, [onDataLoaded]);
      return null;
    }),
  };
});

describe("M07 history recovery", () => {
  afterEach(() => {
    cleanup();
    mockFocusCallbacks = [];
    jest.restoreAllMocks();
  });

  it("shows Alpha rather than Hadir for an absent record", async () => {
    const view = await render(<Riwayat />);
    await waitFor(() => expect(view.getByText("Alpha")).toBeTruthy());
  });

  it("hides old history and statistics when calendar data becomes unavailable", async () => {
    const view = await render(<Riwayat />);
    await waitFor(() => expect(view.getByText("Alpha")).toBeTruthy());
    await act(() => mockCalendarUpdate(null));
    expect(view.queryByText("Alpha")).toBeNull();
    expect(view.queryByText("Hadir")).toBeNull();
  });

  it("shows a recoverable failure rather than an empty leave history", async () => {
    const request = jest
      .spyOn(api, "listPermits")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    const view = await render(<StatusPerizinanScreen />);
    await waitFor(() =>
      expect(view.getByText("Tidak dapat memuat data perizinan.")).toBeTruthy(),
    );
    expect(view.queryByText("Tidak ada data perizinan.")).toBeNull();
    expect(
      view.getByLabelText("Ajukan Perizinan Baru").props.accessibilityState
        .disabled,
    ).toBe(true);
    fireEvent.press(view.getByRole("button", { name: "Coba lagi" }));
    await waitFor(() =>
      expect(view.getByText("Tidak ada data perizinan.")).toBeTruthy(),
    );
    expect(request).toHaveBeenCalledTimes(2);
    expect(
      view.getByLabelText("Ajukan Perizinan Baru").props.accessibilityState
        .disabled,
    ).toBe(false);
  });

  it("keeps existing leave records visible but blocks a new request after refresh fails", async () => {
    jest
      .spyOn(api, "listPermits")
      .mockResolvedValueOnce([
        {
          id: "permit",
          kategori_izin: "izin",
          deskripsi: "Keperluan keluarga",
          approval_status: "rejected",
          tanggal: "2026-10-01",
          created_at: "2026-10-01T01:00:00Z",
        },
      ])
      .mockRejectedValueOnce(new Error("offline"));
    const view = await render(<StatusPerizinanScreen />);
    await waitFor(() =>
      expect(view.getByText(/Keperluan keluarga/)).toBeTruthy(),
    );
    await act(async () => {
      mockFocusCallbacks[0]();
    });
    await waitFor(() =>
      expect(view.getByText("Tidak dapat memuat data perizinan.")).toBeTruthy(),
    );
    expect(view.getByText(/Keperluan keluarga/)).toBeTruthy();
    expect(
      view.getByLabelText("Ajukan Perizinan Baru").props.accessibilityState
        .disabled,
    ).toBe(true);
  });
});
