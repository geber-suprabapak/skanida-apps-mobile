import * as React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react-native";
import { View, TextInput, Text as RNText } from "react-native";

import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

describe("Phase 1: Hardening & Integrity Invariants", () => {
  const rootDir = process.cwd();

  describe("UI Primitives forwardRef and displayName contracts", () => {
    it("Input forwards ref and declares displayName", async () => {
      expect(Input.displayName).toBe("Input");
      const ref = React.createRef<TextInput>();
      const { getByTestId } = await render(
        <Input ref={ref} testID="test-input" />,
      );
      expect(getByTestId("test-input")).toBeTruthy();
      expect(ref.current).toBeDefined();
    });

    it("Card family forwards ref and declares displayNames", async () => {
      expect(Card.displayName).toBe("Card");
      expect(CardHeader.displayName).toBe("CardHeader");
      expect(CardTitle.displayName).toBe("CardTitle");
      expect(CardDescription.displayName).toBe("CardDescription");
      expect(CardContent.displayName).toBe("CardContent");
      expect(CardFooter.displayName).toBe("CardFooter");

      const cardRef = React.createRef<View>();
      const headerRef = React.createRef<View>();
      const titleRef = React.createRef<any>();
      const descRef = React.createRef<any>();
      const contentRef = React.createRef<View>();
      const footerRef = React.createRef<View>();

      await render(
        <Card ref={cardRef} testID="card">
          <CardHeader ref={headerRef} testID="card-header">
            <CardTitle ref={titleRef} testID="card-title">
              Title
            </CardTitle>
            <CardDescription ref={descRef} testID="card-desc">
              Desc
            </CardDescription>
          </CardHeader>
          <CardContent ref={contentRef} testID="card-content">
            <Text>Content</Text>
          </CardContent>
          <CardFooter ref={footerRef} testID="card-footer">
            <Text>Footer</Text>
          </CardFooter>
        </Card>,
      );

      expect(cardRef.current).toBeDefined();
      expect(headerRef.current).toBeDefined();
      expect(titleRef.current).toBeDefined();
      expect(descRef.current).toBeDefined();
      expect(contentRef.current).toBeDefined();
      expect(footerRef.current).toBeDefined();
    });

    it("Badge forwards ref and declares displayName", async () => {
      expect(Badge.displayName).toBe("Badge");
      const badgeRef = React.createRef<View>();
      const { getByTestId } = await render(
        <Badge ref={badgeRef} testID="badge">
          <Text>Badge Text</Text>
        </Badge>,
      );
      expect(getByTestId("badge")).toBeTruthy();
      expect(badgeRef.current).toBeDefined();
    });

    it("Text forwards ref and declares displayName", async () => {
      expect(Text.displayName).toBe("Text");
      const textRef = React.createRef<RNText>();
      const { getByTestId } = await render(
        <Text ref={textRef} testID="text">
          Hello Text
        </Text>,
      );
      expect(getByTestId("text")).toBeTruthy();
      expect(textRef.current).toBeDefined();
    });
  });

  describe("Purge face_sample.jpg test fixture", () => {
    it("ensures zero references to face_sample.jpg in production source files", () => {
      const targetFiles = [
        "app/attendance/CameraAttendance.tsx",
        "app/profile/enroll.tsx",
        "features/attendance-workflow/index.ts",
      ];

      for (const relativePath of targetFiles) {
        const fullPath = join(rootDir, relativePath);
        const content = readFileSync(fullPath, "utf8");
        expect(content).not.toContain("face_sample.jpg");
      }
    });

    it("ensures CameraAttendance.tsx has no legacy FileSystem import", () => {
      const content = readFileSync(
        join(rootDir, "app/attendance/CameraAttendance.tsx"),
        "utf8",
      );
      expect(content).not.toContain("expo-file-system");
    });
  });

  describe("ConnectionChecker non-blocking offline banner and no iOS exit trap", () => {
    it("ensures zero references to BackHandler.exitApp() or Alert.alert in ConnectionChecker.tsx", () => {
      const content = readFileSync(
        join(rootDir, "components/ConnectionChecker.tsx"),
        "utf8",
      );
      expect(content).not.toContain("BackHandler.exitApp");
      expect(content).not.toContain("Alert.alert");
      expect(content).toContain("TopOfflineBanner");
      expect(content).toContain("useSafeAreaInsets");
      expect(content).toContain("Tidak ada koneksi internet");
      expect(content).toContain("Coba Lagi");
    });
  });

  describe("Camera permission recovery in CameraAttendance.tsx", () => {
    it("includes Linking.openSettings() and router.back() in permission view", () => {
      const content = readFileSync(
        join(rootDir, "app/attendance/CameraAttendance.tsx"),
        "utf8",
      );
      expect(content).toContain("Linking.openSettings()");
      expect(content).toContain("Buka Pengaturan Aplikasi");
      expect(content).toContain("router.back()");
    });
  });

  describe("KeyboardAvoidingView integration", () => {
    it("integrates KeyboardAvoidingView and keyboardShouldPersistTaps in izin.tsx", () => {
      const content = readFileSync(
        join(rootDir, "app/perizinan/izin.tsx"),
        "utf8",
      );
      expect(content).toContain("KeyboardAvoidingView");
      expect(content).toContain(
        'behavior={Platform.OS === "ios" ? "padding" : "height"}',
      );
      expect(content).toContain('keyboardShouldPersistTaps="handled"');
    });

    it("integrates KeyboardAvoidingView in ManageAccount.tsx", () => {
      const content = readFileSync(
        join(rootDir, "app/profile/ManageAccount.tsx"),
        "utf8",
      );
      expect(content).toContain("KeyboardAvoidingView");
      expect(content).toContain(
        'behavior={Platform.OS === "ios" ? "padding" : "height"}',
      );
      expect(content).toContain('keyboardShouldPersistTaps="handled"');
    });
  });

  describe("Android hardwareBackPress trapping fix in auth screens", () => {
    it("guards hardwareBackPress with router.canGoBack() in Login, Activate, and ResetPassword", () => {
      const authFiles = [
        "app/auth/Login.tsx",
        "app/auth/Activate.tsx",
        "app/auth/ResetPassword.tsx",
      ];

      for (const relativePath of authFiles) {
        const fullPath = join(rootDir, relativePath);
        const content = readFileSync(fullPath, "utf8");
        expect(content).toContain("router.canGoBack()");
        expect(content).toContain("return false;");
      }
    });
  });

  describe("Modal onRequestClose in pop-up.tsx", () => {
    it("attaches onRequestClose={hideAnimation} to Modal", () => {
      const content = readFileSync(
        join(rootDir, "components/ui/pop-up.tsx"),
        "utf8",
      );
      expect(content).toContain("onRequestClose={hideAnimation}");
    });
  });

  describe("Password requirement copy alignment in ManageAccount.tsx", () => {
    it("displays 8-character requirement copy matching validation regex", () => {
      const content = readFileSync(
        join(rootDir, "app/profile/ManageAccount.tsx"),
        "utf8",
      );
      expect(content).toContain("Minimal 8 karakter (A-Z, a-z, 0-9)");
      expect(content).not.toContain("Minimal 6 karakter");
    });
  });
});
