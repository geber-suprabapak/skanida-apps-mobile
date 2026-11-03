import * as React from "react";
import { ActionSheetIOS, Alert } from "react-native";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as api from "~/utils/bffMobileApi";
import LeaveRequestScreen from "../app/perizinan/izin";

const mockUser = { id: "synthetic-student" };

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/store/authStore", () => ({
  __esModule: true,
  default: (selector: (state: { user: typeof mockUser }) => typeof mockUser) =>
    selector({ user: mockUser }),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
  PermissionStatus: { GRANTED: "granted" },
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-router", () => {
  const React = require("react");
  const actual = jest.requireActual("../__mocks__/expo-router");
  return {
    ...actual,
    useFocusEffect: (callback: () => void) =>
      React.useEffect(() => callback(), [callback]),
  };
});

describe("Leave Request photo picker recovery", () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    jest
      .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
      .mockImplementation((_options, onPress) => onPress(2));
    jest.spyOn(api, "listPermits").mockResolvedValue([]);
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({
        status: ImagePicker.PermissionStatus.GRANTED,
        granted: true,
        canAskAgain: true,
        expires: "never",
      });
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: true,
      assets: null,
    });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  async function chooseGallery() {
    const screen = await render(<LeaveRequestScreen />);
    await waitFor(() =>
      expect(screen.getByLabelText("Unggah bukti foto perizinan")).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText("Unggah bukti foto perizinan"));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith(
        "Error",
        "Gagal memilih foto dari galeri",
      ),
    );
  }

  it("shows a recoverable message when requesting gallery permission fails", async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockRejectedValueOnce(new Error("permission request failed"));

    await chooseGallery();

    expect(alertSpy).toHaveBeenLastCalledWith(
      "Error",
      "Gagal memilih foto dari galeri",
    );
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("shows a recoverable message when launching the native gallery fails", async () => {
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockRejectedValueOnce(new Error("picker launch failed"));

    await chooseGallery();

    expect(alertSpy).toHaveBeenLastCalledWith(
      "Error",
      "Gagal memilih foto dari galeri",
    );
  });
});
