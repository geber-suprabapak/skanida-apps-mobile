import * as React from "react";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useOptimizedMonthlyAttendance } from "~/components/attendance-calendar/hooks";
import AttendanceCalendar from "~/components/attendance-calendar";
import * as api from "~/utils/bffMobileApi";

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/store/authStore", () => ({
  __esModule: true,
  default: (selector: any) => selector({ user: { id: "calendar-ui-fixture" } }),
}));

describe("M07 calendar recovery", () => {
  afterEach(() => jest.restoreAllMocks());

  it("distinguishes a failed read from an empty month and permits retry", async () => {
    jest
      .spyOn(api, "listAttendances")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    jest.spyOn(api, "listPermits").mockResolvedValue([]);
    const { result } = await renderHook(() =>
      useOptimizedMonthlyAttendance("error-fixture", 2035, 0),
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBe(true);
    expect(result.current.data).toBeNull();
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.error).toBe(false);
    expect(result.current.data).toEqual({});
  });

  it("does not apply a late response from a previous month over a cached month", async () => {
    let finish: (items: api.BffAttendanceRecord[]) => void = () => {};
    const pending = new Promise<api.BffAttendanceRecord[]>((resolve) => {
      finish = resolve;
    });
    const attendance = jest
      .spyOn(api, "listAttendances")
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(pending);
    jest.spyOn(api, "listPermits").mockResolvedValue([]);
    const { result, rerender } = await renderHook(
      ({ month }: { month: number }) =>
        useOptimizedMonthlyAttendance("race-fixture", 2035, month),
      { initialProps: { month: 0 } },
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({});
    await rerender({ month: 1 });
    let ongoing: Promise<void> | undefined;
    await act(() => {
      ongoing = result.current.refetch();
    });
    await waitFor(() => expect(attendance).toHaveBeenCalledTimes(2));
    await rerender({ month: 0 });
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual({});
    await act(async () => {
      finish([
        {
          id: "late",
          user_id: "synthetic",
          date: "2035-02-01",
          status: "Hadir",
          created_at: "2035-02-01T00:00:00Z",
        },
      ]);
      await ongoing;
    });
    expect(result.current.data).toEqual({});
    expect(result.current.loading).toBe(false);
  });

  it("shows an error and retries the calendar read", async () => {
    const request = jest
      .spyOn(api, "listAttendances")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]);
    jest.spyOn(api, "listPermits").mockResolvedValue([]);
    const onDataLoaded = jest.fn();
    const view = await render(
      <AttendanceCalendar
        currentYear={2036}
        currentMonth={0}
        isDarkColorScheme={false}
        onDataLoaded={onDataLoaded}
      />,
    );
    await waitFor(() =>
      expect(
        view.getByText("Tidak dapat memuat riwayat kehadiran."),
      ).toBeTruthy(),
    );
    expect(onDataLoaded).toHaveBeenLastCalledWith(null);
    await fireEvent.press(view.getByLabelText("Coba lagi memuat riwayat"));
    await waitFor(() => expect(onDataLoaded).toHaveBeenLastCalledWith({}));
    expect(request).toHaveBeenCalledTimes(2);
    expect(
      view.queryByText("Tidak dapat memuat riwayat kehadiran."),
    ).toBeNull();
  });

  it("does not expose the previous student's data after an account change", async () => {
    jest.spyOn(api, "listAttendances").mockResolvedValueOnce([
      {
        id: "a",
        user_id: "student-a",
        date: "2037-01-02",
        status: "Hadir",
        created_at: "2037-01-02T00:00:00Z",
      },
    ]);
    jest.spyOn(api, "listPermits").mockResolvedValue([]);
    const { result, rerender } = await renderHook(
      ({ user }: { user: string }) =>
        useOptimizedMonthlyAttendance(user, 2037, 0),
      { initialProps: { user: "student-a" } },
    );
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data?.["2037-01-02"]).toBeDefined();
    await rerender({ user: "student-b" });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
