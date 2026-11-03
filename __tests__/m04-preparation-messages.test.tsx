import * as React from "react";
import { cleanup, render, waitFor } from "@testing-library/react-native";
import { prepareAttendance } from "~/features/attendance-workflow";
import AbsenceReport from "../app/attendance/AbsenceReport";

const mockUser = { id: "synthetic" };

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/store/authStore", () => ({
  __esModule: true,
  default: (selector: any) => selector({ user: mockUser }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/features/attendance-workflow", () => ({
  prepareAttendance: jest.fn(),
  cancelAttendance: jest.fn(),
}));

describe("attendance preparation messages", () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });
  it.each([
    [
      "location_unavailable",
      "Lokasi belum tersedia. Pastikan lokasi perangkat aktif, lalu segarkan status.",
    ],
    [
      "precheck_unavailable",
      "Status absensi belum dapat diperiksa. Periksa koneksi, lalu segarkan status.",
    ],
  ] as const)("shows specific guidance for %s", async (code, message) => {
    jest.mocked(prepareAttendance).mockResolvedValueOnce({
      status: "failed",
      code,
    });
    const view = await render(<AbsenceReport />);
    await waitFor(() => expect(view.getByText(message)).toBeTruthy());
    expect(view.getByText("Segarkan Status")).toBeTruthy();
  });
});
