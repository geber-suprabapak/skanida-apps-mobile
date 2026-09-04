import * as React from "react";
import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react-native";
import { View, Text as RNText } from "react-native";

const ROOT = path.resolve(__dirname, "..");

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

// Mocks
jest.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light", isDark: false }),
  withUniwind: jest.fn((Comp: any) => Comp),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    Image: (props: any) => React.createElement(View, { ...props, testID: "mock-expo-image" }),
  };
});

jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy(
    {},
    {
      get: () => (props: any) => React.createElement(View, { ...props, testID: "mock-lucide-icon" }),
    },
  );
});

import { CalendarDayComponent } from "../components/attendance-calendar/CalendarDay";
import { Avatar } from "../components/ui/avatar";
import { faceApiError } from "../utils/faceApiDebug";

describe("Empirical Challenge: Requirements R4 & R5 Invariants & Stress Tests", () => {
  // =========================================================================
  // Item 1: Challenge CalendarDay Date Semantics
  // =========================================================================
  describe("Item 1: CalendarDay date semantics logic", () => {
    it("renders future dates unaccented, with opacity-30, muted text, and NO bg-muted", async () => {
      const futureDay = {
        date: 25,
        fullDate: "2026-09-25",
        isCurrentMonth: true,
        isToday: false,
        isFuture: true,
      };

      const { toJSON } = await render(
        <CalendarDayComponent day={futureDay} isDarkColorScheme={false} />,
      );
      const json = toJSON() as any;
      expect(json.props.className).toContain("opacity-30");
      expect(json.props.className).not.toContain("bg-muted");
      expect(json.props.className).not.toContain("border-primary");

      // Check text inside
      const textChild = json.children.find((c: any) => c.type === "Text");
      expect(textChild.props.className).toContain("text-muted-foreground/40");
      expect(textChild.props.className).toContain("font-normal");
    });

    it("renders dark mode future dates without bg-muted or accent", async () => {
      const futureDay = {
        date: 28,
        fullDate: "2026-09-28",
        isCurrentMonth: true,
        isToday: false,
        isFuture: true,
      };

      const { toJSON } = await render(
        <CalendarDayComponent day={futureDay} isDarkColorScheme={true} />,
      );
      const json = toJSON() as any;
      expect(json.props.className).toContain("opacity-30");
      expect(json.props.className).not.toContain("bg-muted");
    });

    it("accents today (without attendance) with primary border and indicator dot", async () => {
      const todayWithoutAttendance = {
        date: 4,
        fullDate: "2026-09-04",
        isCurrentMonth: true,
        isToday: true,
        isFuture: false,
      };

      const { toJSON } = await render(
        <CalendarDayComponent day={todayWithoutAttendance} isDarkColorScheme={false} />,
      );
      const json = toJSON() as any;
      expect(json.props.className).toContain("border-2 border-primary bg-primary/10");

      const textChild = json.children.find((c: any) => c.type === "Text");
      expect(textChild.props.className).toContain("text-primary font-bold");

      // Verify indicator dot exists
      const dot = json.children.find(
        (c: any) => c.type === "View" && c.props.className?.includes("rounded-full bg-primary"),
      );
      expect(dot).toBeDefined();
      expect(dot.props.className).toContain("w-1.5 h-1.5");
    });

    it("renders past attended dates with correct status badges and no today ring", async () => {
      const pastAttended = {
        date: 2,
        fullDate: "2026-09-02",
        isCurrentMonth: true,
        isToday: false,
        isFuture: false,
        attendance: {
          id: "att-1",
          date: "2026-09-02",
          status: "present" as const,
          checkInTime: "07:00",
          checkOutTime: "15:00",
        },
      };

      const { toJSON } = await render(
        <CalendarDayComponent day={pastAttended} isDarkColorScheme={false} />,
      );
      const json = toJSON() as any;
      expect(json.props.className).toContain("bg-emerald-400/50");
      expect(json.props.className).not.toContain("border-primary");

      const textChild = json.children.find((c: any) => c.type === "Text");
      expect(textChild.props.className).toContain("text-emerald-600");
    });

    it("renders past sick and leave days with respective color accents", async () => {
      const leaveDay = {
        date: 1,
        fullDate: "2026-09-01",
        isCurrentMonth: true,
        isToday: false,
        isFuture: false,
        attendance: {
          id: "att-leave",
          date: "2026-09-01",
          status: "leave" as const,
        },
      };
      const { toJSON: leaveJson } = await render(
        <CalendarDayComponent day={leaveDay} isDarkColorScheme={false} />,
      );
      expect((leaveJson() as any).props.className).toContain("bg-blue-50");

      const sickDay = {
        date: 3,
        fullDate: "2026-09-03",
        isCurrentMonth: true,
        isToday: false,
        isFuture: false,
        attendance: {
          id: "att-sick",
          date: "2026-09-03",
          status: "sick" as const,
        },
      };
      const { toJSON: sickJson } = await render(
        <CalendarDayComponent day={sickDay} isDarkColorScheme={false} />,
      );
      expect((sickJson() as any).props.className).toContain("bg-rose-50");
    });
  });

  // =========================================================================
  // Item 2: Challenge Riwayat Scroll Padding & Header
  // =========================================================================
  describe("Item 2: Riwayat scroll padding and header back button elimination", () => {
    it("verifies FlatList contentContainerStyle paddingBottom is 100", () => {
      const source = readSource("app/extra/riwayat.tsx");
      expect(source).toMatch(/contentContainerStyle=\{[\s\S]*?paddingBottom:\s*100/);
      expect(source).not.toMatch(/contentContainerStyle=\{[\s\S]*?paddingBottom:\s*40/);
    });

    it("verifies header back button is removed from Riwayat", () => {
      const source = readSource("app/extra/riwayat.tsx");
      expect(source).not.toContain("ChevronLeft");
      expect(source).not.toMatch(/accessibilityLabel="Kembali"/);
      expect(source).toContain("Riwayat Kehadiran");
    });
  });

  // =========================================================================
  // Item 3: Challenge Dashboard De-cluttering
  // =========================================================================
  describe("Item 3: Dashboard de-cluttering", () => {
    const dashboardSource = readSource("app/Dashboard.tsx");

    it("verifies duplicate Riwayat & Perizinan cards are completely removed", () => {
      expect(dashboardSource).not.toContain("navigateToHistory");
      expect(dashboardSource).not.toContain("navigateToPerizinan");
      expect(dashboardSource).not.toContain("Riwayat Presensi");
      expect(dashboardSource).not.toContain("Perizinan Siswa");
    });

    it("verifies floating version badge is completely removed", () => {
      expect(dashboardSource).not.toContain("absolute bottom-6");
      expect(dashboardSource).not.toMatch(/Skanida v\{/);
      expect(dashboardSource).not.toContain("Constants.expoConfig?.version");
    });

    it("verifies school logo has explicit dimensions", () => {
      expect(dashboardSource).toContain("style={{ width: 40, height: 40 }}");
    });
  });

  // =========================================================================
  // Item 4: Challenge Avatar Unification
  // =========================================================================
  describe("Item 4: Avatar component unification with initials fallback", () => {
    it("Avatar primitive renders initials fallback text when source is missing", async () => {
      const { getByText } = await render(<Avatar fallback="RN" size="lg" />);
      expect(getByText("RN")).toBeTruthy();
    });

    it("Avatar primitive scales correctly across lg and xl sizes", async () => {
      const { toJSON: lgJson } = await render(<Avatar fallback="A" size="lg" />);
      expect((lgJson() as any).props.className).toContain("h-20 w-20");

      const { toJSON: xlJson } = await render(<Avatar fallback="B" size="xl" />);
      expect((xlJson() as any).props.className).toContain("h-28 w-28");
    });

    it("Avatar primitive sets explicit inline 100% dimensions on image", async () => {
      const { getByTestId } = await render(<Avatar source="https://example.com/avatar.jpg" size="md" />);
      const img = getByTestId("mock-expo-image");
      expect(img.props.style).toEqual({ width: "100%", height: "100%" });
    });

    it("Dashboard uses Avatar with initials fallback", () => {
      const dashboard = readSource("app/Dashboard.tsx");
      expect(dashboard).toContain("<Avatar");
      expect(dashboard).toMatch(/fallback=\{displayName\.charAt\(0\)\.toUpperCase\(\)/);
    });

    it("Pengaturan uses Avatar with initials fallback", () => {
      const pengaturan = readSource("app/extra/pengaturan.tsx");
      expect(pengaturan).toContain("<Avatar");
      expect(pengaturan).toMatch(/fallback=\{\(profileName \|\| user\?\.email\)\?\.charAt\(0\)\.toUpperCase\(\)/);
    });

    it("ManageAccount uses Avatar with initials fallback", () => {
      const manageAccount = readSource("app/profile/ManageAccount.tsx");
      expect(manageAccount).toContain("<Avatar");
      expect(manageAccount).toMatch(/fallback=\{\(name \|\| user\?\.email \|\| "S"\)\.charAt\(0\)\.toUpperCase\(\)/);
    });
  });

  // =========================================================================
  // Item 5: Challenge ManageAccount Retitle & Input Contrast
  // =========================================================================
  describe("Item 5: ManageAccount retitle and read-only input contrast", () => {
    const manageAccount = readSource("app/profile/ManageAccount.tsx");

    it("verifies section title is retitled to 'Informasi Akun Siswa'", () => {
      expect(manageAccount).toContain("Informasi Akun Siswa");
      // Check that UI text is not "Edit Profil"
      expect(manageAccount).not.toMatch(/<Text[^>]*>\s*Edit Profil\s*<\/Text>/i);
    });

    it("verifies read-only inputs have elevated contrast classes", () => {
      const matches = manageAccount.match(/className="pl-10 h-12 bg-muted\/30 opacity-100 text-foreground font-medium border-border"/g);
      // All 5 read-only inputs (Name, Email, Kelas, No. Absen, NIS) must have this contrast
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(5);

      // Must not have the old dimming classes
      expect(manageAccount).not.toContain("bg-muted/50 text-muted-foreground border-transparent");
    });
  });

  // =========================================================================
  // Item 6: Challenge Settings (Student NIS, Logout, Copyright)
  // =========================================================================
  describe("Item 6: Pengaturan student NIS, conditional logout, dynamic copyright", () => {
    const pengaturan = readSource("app/extra/pengaturan.tsx");

    it("verifies student NIS is displayed and handled in copy", () => {
      expect(pengaturan).toMatch(/studentNis\s*\?\s*`NIS:\s*\$\{studentNis\}`\s*:\s*"NIS Belum Terdaftar"/);
      expect(pengaturan).toMatch(/accessibilityLabel="Salin NIS Siswa"/);
      expect(pengaturan).toContain("const val = studentNis || user?.id;");
    });

    it("verifies logout is conditionally rendered only when user exists", () => {
      expect(pengaturan).toContain("{Boolean(user) && (");
      expect(pengaturan).toContain("Keluar dari Akun");
    });

    it("verifies copyright year is dynamically computed", () => {
      expect(pengaturan).toContain("© {new Date().getFullYear()} Skanida Apps");
      expect(pengaturan).not.toContain("© 2025 Skanida Apps");
    });
  });

  // =========================================================================
  // Item 7: Challenge Activate Layout & Terminology
  // =========================================================================
  describe("Item 7: Activate vertical layout and no Astra jargon", () => {
    const activate = readSource("app/auth/Activate.tsx");

    it("verifies justify-center is removed from main container and scroll padding added", () => {
      expect(activate).toContain('contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }}');
      expect(activate).toContain('className="w-full items-center px-8 py-8"');
      expect(activate).not.toContain('className="flex-1 justify-center items-center px-8 py-8"');
    });

    it("verifies Astra jargon is replaced with school-friendly terminology", () => {
      expect(activate).not.toContain("Astra akan memvalidasi");
      expect(activate).toMatch(/Sistem sekolah akan memvalidasi NIS terhadap data siswa[\s\S]*?saat pendaftaran dikirim\./);
    });
  });

  // =========================================================================
  // Item 8: Challenge faceApiDebug
  // =========================================================================
  describe("Item 8: faceApiDebug error logging", () => {
    const debugSource = readSource("utils/faceApiDebug.ts");

    it("verifies faceApiError uses console.warn instead of console.error", () => {
      expect(debugSource).not.toContain("console.error");
      expect(debugSource).toContain("console.warn(`${PREFIX} ${event}`, normalizedPayload);");
    });

    it("empirically verifies calling faceApiError routes to console.warn", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      faceApiError("test-error-event", { detail: "mock error" });

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      const warnArgs = warnSpy.mock.calls[0];
      expect(warnArgs[0]).toContain("[FaceAPI DEV] test-error-event");

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
