import * as React from "react";
import { render, fireEvent, cleanup } from "@testing-library/react-native";
import { Linking, BackHandler } from "react-native";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Mocks for CameraAttendance dependencies
const mockRouterBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockRouterBack,
    canGoBack: mockCanGoBack,
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: () => null,
  },
}));

jest.mock("react-native-vision-camera", () => ({
  Camera: () => null,
  useCameraDevice: () => ({ id: "front-camera" }),
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: mockRequestPermission,
  }),
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (comp: any) => comp,
    },
    useSharedValue: (val: any) => ({ value: val }),
    useAnimatedStyle: () => ({}),
    withTiming: (toValue: any) => toValue,
    withRepeat: (anim: any) => anim,
    withSequence: (...anims: any[]) => anims[0],
  };
});

jest.mock("expo-auth-session", () => ({
  makeRedirectUri: () => "skanida://callback",
  useAuthRequest: () => [null, null, jest.fn()],
}));

jest.mock("expo-constants", () => ({
  expoConfig: { scheme: "skanida" },
}));

jest.mock("expo-notifications", () => ({
  PermissionStatus: {
    UNDETERMINED: "undetermined",
    GRANTED: "granted",
    DENIED: "denied",
  },
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy(
    {},
    {
      get: () => (props: any) => React.createElement(View, props),
    },
  );
});

// Import component under test
import CameraAttendance from "@/app/attendance/CameraAttendance";
import LoginScreen from "@/app/auth/Login";
import ActivateScreen from "@/app/auth/Activate";
import ResetPasswordScreen from "@/app/auth/ResetPassword";

describe("Milestone 1 Empirical & Adversarial Challenges", () => {
  beforeAll(() => {
    jest.setTimeout(15000);
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Challenge 1: Absolute elimination of face_sample fixtures", () => {
    it("scans every source file in app/, features/, components/ for any occurrence of face_sample", () => {
      const rootDir = process.cwd();
      const targetDirs = ["app", "features", "components", "lib", "utils"];
      const discoveredMatches: string[] = [];

      function walk(dir: string) {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walk(fullPath);
          } else if (/\.(tsx?|jsx?|json)$/.test(entry)) {
            const content = readFileSync(fullPath, "utf-8");
            if (content.includes("face_sample")) {
              discoveredMatches.push(fullPath);
            }
          }
        }
      }

      for (const d of targetDirs) {
        walk(join(rootDir, d));
      }

      expect(discoveredMatches).toEqual([]);
    });
  });

  describe("Challenge 2: Camera permission denial recovery in CameraAttendance", () => {
    it("renders permission denial view when hasPermission is false", async () => {
      const { getByText, getByLabelText } = await render(<CameraAttendance />);

      expect(getByText("Izinkan akses kamera")).toBeTruthy();
      expect(getByLabelText("Kembali")).toBeTruthy();
      expect(getByLabelText("Buka Pengaturan Aplikasi")).toBeTruthy();
    });

    it("triggers router.back() when user presses back button", async () => {
      const { getByLabelText } = await render(<CameraAttendance />);
      const backBtn = getByLabelText("Kembali");

      fireEvent.press(backBtn);
      expect(mockRouterBack).toHaveBeenCalledTimes(1);
    });

    it("triggers Linking.openSettings() when settings button is pressed", async () => {
      const spyOpenSettings = jest
        .spyOn(Linking, "openSettings")
        .mockResolvedValue(undefined as any);

      const { getByLabelText } = await render(<CameraAttendance />);
      const settingsBtn = getByLabelText("Buka Pengaturan Aplikasi");

      fireEvent.press(settingsBtn);
      expect(spyOpenSettings).toHaveBeenCalledTimes(1);
      spyOpenSettings.mockRestore();
    });

    it("safeguards Linking.openSettings against unhandled promise rejections", () => {
      const source = readFileSync(
        join(process.cwd(), "app/attendance/CameraAttendance.tsx"),
        "utf-8",
      );

      // Adversarial requirement 2: Check that Linking.openSettings() cannot throw unhandled rejections.
      // On real devices, openSettings() can reject if system intents fail, restricted profile, or simulator.
      // If onPress returns a raw unhandled promise without .catch or try/catch, Hermes/Node throws UnhandledPromiseRejection.
      const hasRejectionGuard =
        /Linking\.openSettings\(\)\s*\.catch/.test(source) ||
        /try\s*\{[^}]*Linking\.openSettings/.test(source);

      expect(hasRejectionGuard).toBe(true);
    });
  });

  describe("Challenge 3: Hardware back press stress test in Auth Screens", () => {
    let backPressHandler: (() => boolean) | null = null;
    let addEventListenerSpy: jest.SpyInstance;

    beforeEach(() => {
      backPressHandler = null;
      addEventListenerSpy = jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((event: any, handler: any) => {
          if (event === "hardwareBackPress") {
            backPressHandler = handler;
          }
          return { remove: jest.fn() } as any;
        });
    });

    afterEach(() => {
      addEventListenerSpy.mockRestore();
    });

    describe("Login.tsx hardwareBackPress", () => {
      it("returns false (allows system exit) when router.canGoBack() is false", async () => {
        mockCanGoBack.mockReturnValue(false);
        await render(<LoginScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it("returns true and calls router.back() when router.canGoBack() is true", async () => {
        mockCanGoBack.mockReturnValue(true);
        await render(<LoginScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
      });
    });

    describe("Activate.tsx hardwareBackPress", () => {
      it("returns false (allows system exit) when router.canGoBack() is false", async () => {
        mockCanGoBack.mockReturnValue(false);
        await render(<ActivateScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it("returns true and calls router.back() when router.canGoBack() is true", async () => {
        mockCanGoBack.mockReturnValue(true);
        await render(<ActivateScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
      });
    });

    describe("ResetPassword.tsx hardwareBackPress", () => {
      it("returns false (allows system exit) when router.canGoBack() is false", async () => {
        mockCanGoBack.mockReturnValue(false);
        await render(<ResetPasswordScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).not.toHaveBeenCalled();
        expect(result).toBe(false);
      });

      it("returns true and calls router.back() when router.canGoBack() is true", async () => {
        mockCanGoBack.mockReturnValue(true);
        await render(<ResetPasswordScreen />);

        expect(backPressHandler).not.toBeNull();
        const result = backPressHandler!();

        expect(mockCanGoBack).toHaveBeenCalled();
        expect(mockRouterBack).toHaveBeenCalledTimes(1);
        expect(result).toBe(true);
      });
    });
  });
});
