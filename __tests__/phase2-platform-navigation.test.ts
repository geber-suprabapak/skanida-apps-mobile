import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 2 platform navigation contracts", () => {
  it("provides the four primary workflows in a persistent tabs layout", () => {
    const layout = source("app/(tabs)/_layout.tsx");

    expect(layout).toContain('import { Tabs } from "expo-router"');
    for (const route of ["home", "riwayat", "perizinan", "pengaturan"]) {
      expect(layout).toContain(`name="${route}"`);
    }
    expect(layout).toContain("tabBarHideOnKeyboard: true");
  });

  it("keeps tab targets as file routes while preserving legacy screens", () => {
    expect(source("app/(tabs)/home.tsx")).toContain('from "../Dashboard"');
    expect(source("app/(tabs)/riwayat.tsx")).toContain(
      'from "../extra/riwayat"',
    );
    expect(source("app/(tabs)/perizinan.tsx")).toContain(
      'from "../perizinan/status"',
    );
    expect(source("app/(tabs)/pengaturan.tsx")).toContain(
      'from "../extra/pengaturan"',
    );
  });

  it("enables Stack navigation for detail workflows and keeps only camera immersive", () => {
    const layout = source("app/_layout.tsx");

    expect(layout).toContain("gestureEnabled: true");
    for (const route of [
      "attendance/AbsenceReport",
      "profile/ManageAccount",
      "profile/enroll",
      "perizinan/izin",
      "perizinan/status",
    ]) {
      expect(layout).toContain(`name="${route}"`);
    }
    expect(layout).toContain('name="attendance/CameraAttendance"');
    expect(layout).toContain("headerShown: false");
  });

  it("protects controls and content from system bars and expanded widths", () => {
    const camera = source("app/attendance/CameraAttendance.tsx");
    const enroll = source("app/profile/enroll.tsx");
    const account = source("app/profile/ManageAccount.tsx");
    const button = source("components/ui/button.tsx");
    const input = source("components/ui/input.tsx");
    const dashboard = source("app/Dashboard.tsx");
    const settings = source("app/extra/pengaturan.tsx");
    const permits = source("app/perizinan/status.tsx");

    expect(camera).toContain("useSafeAreaInsets");
    expect(camera).toContain("safeAreaInsets.bottom + 12");
    expect(enroll).toContain("useSafeAreaInsets");
    expect(enroll).toContain("insets.bottom + 12");
    expect(account).toContain("safeAreaInsets.bottom + 16");
    expect(button).toContain("min-h-12");
    expect(input).toContain("min-h-12");
    expect(dashboard).toContain("maxFontSizeMultiplier={1.3}");
    for (const screen of [dashboard, settings, permits]) {
      expect(screen).toContain("maxWidth: 672");
      expect(screen).toContain('alignSelf: "center"');
    }
  });
});
