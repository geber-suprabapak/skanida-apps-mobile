import * as React from "react";
import { Alert } from "react-native";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react-native";

import ManageAccount from "../app/profile/ManageAccount";
import { getProfile, updateAvatar } from "~/utils/bffMobileApi";
import * as ImagePicker from "expo-image-picker";
/**
 * M08 — Profile loading and avatar picker failures are recoverable.
 *
 * ManageAccount must distinguish loading / ready / error for the profile
 * read, offer a retry that re-invokes getProfile() (not merely a
 * connectivity recheck), and surface actionable picker exceptions while
 * keeping the picker cancel as a deliberate no-op.
 *
 * All data here is synthetic; no live request, credential, or device
 * capture is involved. Native picker/permission behavior on a physical
 * Android device is a separate blocked evidence item, not covered here.
 */

const mockUser = {
  id: "user-1",
  email: "siswa@sekolah.sch.id",
  user_metadata: {
    name: "Budi",
    absence_number: "07",
    class_name: "XII RPL 1",
    nis: "12345",
    avatar_url: null,
  },
};

// Module mocking is the only seam available to these tests: ManageAccount
// imports the auth store, the BFF client, and Expo native modules directly,
// and adding dependency-injection parameters would change production app
// code, which is out of scope for this recovery-behaviour test. Each
// jest.mock below is a deliberate, per-file substitute boundary.
// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/store/authStore", () => {
  const useAuthStore: any = (selector: any) =>
    selector({
      user: mockUser,
    });
  useAuthStore.getState = () => ({
    logout: jest.fn(async () => {}),
  });
  return { __esModule: true, default: useAuthStore };
});

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/bffMobileApi", () => ({
  getProfile: jest.fn(),
  updateAvatar: jest.fn(),
  changePassword: jest.fn(),
  getEnrollmentStatus: jest.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/enrollment", () => ({
  fetchEnrollmentStatus: jest.fn(async () => ({
    status: "not_enrolled" as const,
  })),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/faceApiDebug", () => ({
  faceApiLog: jest.fn(),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("~/utils/faceApiRuntime", () => ({
  fetchFaceApiRuntimeStatus: jest.fn(async () => ({
    state: "healthy" as const,
    message: "ok",
  })),
}));

// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  MediaTypeOptions: { Images: "Images" },
}));

type ImagePickerMocks = typeof ImagePicker & {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  requestCameraPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
  launchCameraAsync: jest.Mock;
};

// SAFETY: the jest.mock factory above replaces exactly these four picker
// functions with jest.Mock doubles at runtime; the intersection narrows only
// those members and keeps every other ImagePicker export at its real type.
const mockImagePicker = ImagePicker as ImagePickerMocks;

// The shared expo-router mock invokes useFocusEffect callbacks synchronously
// during render; ManageAccount's focus callback sets state immediately, which
// re-triggers the synchronous call and loops. Run the focus callback in a
// post-mount effect instead — the same lifecycle the real hook provides.
// oxlint-disable-next-line anti-slop/no-module-mocking
jest.mock("expo-router", () => {
  const React = require("react");
  const actual = jest.requireActual("../__mocks__/expo-router");
  return {
    ...actual,
    useFocusEffect: (callback: () => void) => {
      React.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

const profileData = {
  full_name: "Budi Santoso",
  email: "siswa@sekolah.sch.id",
  absence_number: 7,
  class_name: "XII RPL 1",
  nis: "12345",
  avatar_url: "https://cdn.example/avatar.png",
};

describe("M08 — Profile load and avatar picker recovery", () => {
  let alertSpy: jest.SpyInstance;

  const openAvatarOptions = async (screen: any) => {
    await waitFor(() =>
      expect(screen.getByLabelText("Ganti foto profil")).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText("Ganti foto profil"));
    await waitFor(() =>
      expect(screen.getByText("Pilih dari Galeri")).toBeTruthy(),
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    // Every scenario starts from a settled profile read; individual tests
    // override with mockRejectedValueOnce/mockResolvedValueOnce as needed.
    // SAFETY: getProfile is the jest.Mock double installed by the factory above.
    (getProfile as jest.Mock).mockResolvedValue(profileData);
    // SAFETY: updateAvatar is the jest.Mock double installed by the factory above.
    (updateAvatar as jest.Mock).mockReset();
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({
      status: "granted",
    });
    mockImagePicker.launchImageLibraryAsync.mockReset();
    mockImagePicker.launchCameraAsync.mockReset();
  });

  afterEach(() => {
    alertSpy.mockRestore();
    cleanup();
  });

  it("shows a loading state and populates profile fields once getProfile resolves", async () => {
    // Hold the read open so the distinct loading state is observable.
    let resolveProfile!: (value: typeof profileData) => void;
    // SAFETY: getProfile is the jest.Mock double installed by the factory above.
    (getProfile as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );
    const screen = await render(<ManageAccount />);

    // Loading is distinct: the profile form area shows the loading row
    // before the read settles.
    expect(screen.getByLabelText("Memuat profil")).toBeTruthy();

    await act(async () => {
      resolveProfile(profileData);
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy();
    });
    expect(screen.getByDisplayValue("7")).toBeTruthy();
    expect(screen.getByDisplayValue("XII RPL 1")).toBeTruthy();
    expect(getProfile).toHaveBeenCalledTimes(1);
    // No error banner in the ready state.
    expect(screen.queryByText("Gagal Memuat Profil")).toBeNull();
  });

  it("shows a recoverable error on getProfile rejection and retry re-invokes the profile read", async () => {
    // SAFETY: getProfile is the jest.Mock double installed by the factory above.
    (getProfile as jest.Mock).mockRejectedValueOnce(
      new Error("Permintaan ke server gagal"),
    );
    const screen = await render(<ManageAccount />);

    // Error state is explicit instead of silently blank fields.
    await waitFor(() =>
      expect(screen.getByText("Gagal Memuat Profil")).toBeTruthy(),
    );
    expect(screen.getByText("Permintaan ke server gagal")).toBeTruthy();
    // Fields stay blank while the read has failed.
    expect(screen.getByPlaceholderText("Nama Lengkap").props.value).toBe("");

    // Retry must invoke the failed profile operation again.
    // SAFETY: getProfile is the jest.Mock double installed by the factory above.
    (getProfile as jest.Mock).mockResolvedValueOnce(profileData);
    fireEvent.press(screen.getByLabelText("Coba Muat Ulang Profil"));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy();
    });
    expect(getProfile).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Gagal Memuat Profil")).toBeNull();
  });

  it("surfaces a denied gallery permission with an actionable alert and never opens the picker", async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
      status: "denied",
    });
    const screen = await render(<ManageAccount />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy(),
    );
    await openAvatarOptions(screen);

    fireEvent.press(screen.getByText("Pilih dari Galeri"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Izin Ditolak",
        expect.stringContaining("pengaturan perangkat"),
      ),
    );
    expect(mockImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(updateAvatar).not.toHaveBeenCalled();
  });

  it("surfaces a gallery launch failure with an actionable alert instead of swallowing it", async () => {
    mockImagePicker.launchImageLibraryAsync.mockRejectedValueOnce(
      new Error("Picker gagal dibuka"),
    );
    const screen = await render(<ManageAccount />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy(),
    );
    await openAvatarOptions(screen);

    fireEvent.press(screen.getByText("Pilih dari Galeri"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Gagal Membuka Galeri",
        expect.stringContaining("coba lagi"),
      ),
    );
    expect(updateAvatar).not.toHaveBeenCalled();
  });

  it("treats a picker cancel as a no-op with no alert and no upload", async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: true,
      assets: [],
    });
    const screen = await render(<ManageAccount />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy(),
    );
    await openAvatarOptions(screen);

    fireEvent.press(screen.getByText("Pilih dari Galeri"));

    await waitFor(() =>
      expect(mockImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1),
    );
    // Cancel is silent: no alert of any kind, no upload, no state change.
    expect(alertSpy).not.toHaveBeenCalled();
    expect(updateAvatar).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy();
  });

  it("rejects invalid picker media with an alert and does not upload", async () => {
    mockImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ width: 1, height: 1 }], // asset without a usable uri
    });
    const screen = await render(<ManageAccount />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy(),
    );
    await openAvatarOptions(screen);

    fireEvent.press(screen.getByText("Pilih dari Galeri"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Media Tidak Valid",
        expect.stringContaining("pilih gambar lain"),
      ),
    );
    expect(updateAvatar).not.toHaveBeenCalled();
  });

  it("alerts with a recoverable message when the avatar upload itself fails", async () => {
    // SAFETY: updateAvatar is the jest.Mock double installed by the factory above.
    (updateAvatar as jest.Mock).mockRejectedValueOnce(
      new Error("Gagal unggah avatar"),
    );
    mockImagePicker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: "file:///cache/avatar_pick.jpeg", width: 100, height: 100 },
      ],
    });
    const screen = await render(<ManageAccount />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Budi Santoso")).toBeTruthy(),
    );
    await openAvatarOptions(screen);

    fireEvent.press(screen.getByText("Pilih dari Galeri"));

    await waitFor(() =>
      expect(updateAvatar).toHaveBeenCalledWith({
        uri: "file:///cache/avatar_pick.jpeg",
        name: expect.stringMatching(/^avatar_\d+\.jpeg$/),
        type: "image/jpeg",
      }),
    );
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "Gagal Upload",
        "Terjadi kesalahan saat mengunggah foto.",
      ),
    );
  });
});
