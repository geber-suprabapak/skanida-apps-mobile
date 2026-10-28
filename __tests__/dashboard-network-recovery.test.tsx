import * as React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import * as Router from "expo-router";
import Dashboard from "../app/Dashboard";
import ConnectionChecker from "../components/ConnectionChecker";
import useAuthStore from "../store/authStore";
import * as api from "../utils/bffMobileApi";
import * as face from "../utils/faceApiRuntime";
import * as enrollment from "../utils/enrollment";
import { timeSync } from "../utils/timeSync";

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: "wifi" | "none";
};
let mockConnected = true;
let mockNetworkListener: ((state: NetworkState) => void) | undefined;
// Native connectivity is the input boundary; exercise the real provider and screen.
// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(async () => ({
      isConnected: mockConnected,
      isInternetReachable: mockConnected,
      type: mockConnected ? "wifi" : "none",
    })),
    addEventListener: jest.fn((listener: (state: NetworkState) => void) => {
      mockNetworkListener = listener;
      return jest.fn();
    }),
  },
}));

const dashboard: api.BffDashboard = {
  profile: {
    user_id: "student-test",
    full_name: "Siswa Test",
    email: "student@example.test",
    nis: "123",
    class_name: "X Test",
    absence_number: "3",
    avatar_url: null,
    lifecycle_status: "approved",
  },
  attendance: {
    today_status: "present",
    has_checked_in: true,
    has_checked_out: true,
    check_in_time: "2026-10-27T23:00:00Z",
    check_out_time: "2026-10-28T06:04:00Z",
    total_work_hours: 7.07,
  },
  schedule: null,
  face: {
    server_status: "healthy",
    enrollment_status: "not_enrolled",
    message: "Wajah belum terdaftar",
  },
  permit: { has_active_permit: false, active_category: null },
  primary_action: {
    allowed: false,
    type: null,
    reason_code: "ATTENDANCE_COMPLETE",
    label: "Selesai",
    reason_message: "Presensi selesai",
  },
  server_time: {
    now: "2026-10-28T08:30:00Z",
    timezone: "Asia/Jakarta",
    source: "bff",
  },
};

describe("Dashboard recovery after an offline start", () => {
  let read: jest.SpiedFunction<typeof api.getDashboard>;
  beforeEach(() => {
    jest.useFakeTimers();
    mockConnected = true;
    mockNetworkListener = undefined;
    // The shared router mock calls focus callbacks during render; use real effect timing.
    jest.spyOn(Router, "useFocusEffect").mockImplementation((callback) => {
      React.useEffect(callback, [callback]);
    });
    jest
      .spyOn(timeSync, "getSyncedTime")
      .mockReturnValue(new Date("2026-10-28T08:30:00Z"));
    jest.spyOn(timeSync, "forceSyncWithServer").mockResolvedValue(true);
    jest.spyOn(timeSync, "syncWithServer").mockResolvedValue(true);
    useAuthStore.setState({
      user: {
        id: "student-test",
        roles: ["student"],
        mustChangePassword: false,
        user_metadata: { full_name: "Siswa Test" },
      },
      userProfile: null,
    });
    read = jest
      .spyOn(api, "getDashboard")
      .mockRejectedValue(
        new Error("fetch failed: java.net.UnknownHostException"),
      );
    jest.spyOn(face, "fetchFaceApiRuntimeStatus").mockResolvedValue({
      state: "healthy",
      title: "Server siap",
      message: "Siap",
      issues: [],
    });
    jest
      .spyOn(enrollment, "fetchEnrollmentStatus")
      .mockResolvedValue({ status: "not_enrolled" });
  });
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, userProfile: null });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("the advertised server retry reloads attendance and completion, not only face status", async () => {
    await render(<Dashboard />);
    await screen.findByText("Server tidak terhubung");
    read.mockResolvedValue(dashboard);
    await fireEvent.press(screen.getByText("Cek Status Server"));
    expect(await screen.findByText("06:00")).toBeTruthy();
    expect(screen.getByText("13:04")).toBeTruthy();
    expect(screen.getByText("SELESAI")).toBeTruthy();
    expect(screen.queryByText(/UnknownHostException/)).toBeNull();
  });

  it("reloads the complete dashboard when native connectivity returns", async () => {
    mockConnected = false;
    await render(
      <ConnectionChecker>
        <Dashboard />
      </ConnectionChecker>,
    );
    await screen.findByText("Tidak ada koneksi internet");
    await screen.findByText("Server tidak terhubung");
    read.mockResolvedValue(dashboard);
    await act(async () => {
      mockConnected = true;
      mockNetworkListener?.({
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      });
    });
    expect(await screen.findByText("06:00")).toBeTruthy();
    expect(screen.getByText("13:04")).toBeTruthy();
    expect(screen.getByText("SELESAI")).toBeTruthy();
    expect(screen.queryByText("Tidak ada koneksi internet")).toBeNull();
  });
});
