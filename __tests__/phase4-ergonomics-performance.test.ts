import fs from "fs";
import path from "path";
import {
  normalizeBase64,
  base64ByteSize,
} from "../features/attendance-workflow/attendanceWorkflow";

const ROOT = path.resolve(__dirname, "..");

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

describe("Phase 4: Ergonomics, Performance & Polish Invariants", () => {
  describe("R1: Touch Target Compliance & Native Ergonomics", () => {
    it("components/ui/button.tsx configures android_ripple, hitSlop, and accessibilityRole", () => {
      const source = readSource("components/ui/button.tsx");
      expect(source).toContain("android_ripple");
      expect(source).toContain("rippleConfig");
      expect(source).toContain("accessibilityRole");
      expect(source).toContain("hitSlop");
    });

    it("app/perizinan/status.tsx configures 48dp targets, hitSlop, and accessibility attributes", () => {
      const source = readSource("app/perizinan/status.tsx");
      expect(source).toContain(
        "hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}",
      );
      expect(source).toContain('accessibilityRole="button"');
      expect(source).toContain("min-h-[48px]");
    });

    it("app/extra/pengaturan.tsx provides adequate touch target hitSlop on EditButton and copy ID", () => {
      const source = readSource("app/extra/pengaturan.tsx");
      expect(source).toMatch(/EditButton[\s\S]*?hitSlop/);
      expect(source).toMatch(/handleCopyId[\s\S]*?hitSlop/);
      expect(source).toContain('accessibilityRole="switch"');
    });

    it("app/Dashboard.tsx configures 48x48dp dimensions, hitSlop, and min-height 48px", () => {
      const source = readSource("app/Dashboard.tsx");
      expect(source).toContain("w-12 h-12 rounded-full");
      expect(source).toContain("navigateToSettings");
      expect(source).toContain("Sentry.showFeedbackWidget");
      expect(source).toContain("min-h-[48px]");
      expect(source).toContain('accessibilityLabel="Pengaturan"');
      expect(source).toContain('accessibilityLabel="Laporkan Masalah"');
    });

    it("components/ui/month-year-picker.tsx provides 48x48dp touch clearance on navigation buttons", () => {
      const source = readSource("components/ui/month-year-picker.tsx");
      expect(source).toContain(
        "w-12 h-12 rounded-full mr-3 items-center justify-center",
      );
      expect(source).toContain(
        "w-12 h-12 rounded-full ml-3 items-center justify-center",
      );
      expect(source).toContain('accessibilityLabel="Bulan sebelumnya"');
      expect(source).toContain('accessibilityLabel="Bulan berikutnya"');
    });

    it("components/attendance-calendar/index.tsx configures 48x48dp touch clearance and accessibility on refresh button", () => {
      const source = readSource("components/attendance-calendar/index.tsx");
      expect(source).toContain(
        "hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}",
      );
      expect(source).toContain("min-h-12 min-w-12 items-center justify-center");
      expect(source).toContain('accessibilityRole="button"');
      expect(source).toContain(
        'accessibilityLabel="Perbarui kalender kehadiran"',
      );
    });
  });

  describe("R2: Accessibility Standards & OS Motion", () => {
    it("removes variant='h3' from inside Buttons to prevent VoiceOver heading rotor pollution", () => {
      const authSelector = readSource("app/auth/AuthSelector.tsx");
      const activate = readSource("app/auth/Activate.tsx");
      const resetPassword = readSource("app/auth/ResetPassword.tsx");
      const login = readSource("app/auth/Login.tsx");

      expect(authSelector).not.toMatch(/<Button[\s\S]*?<Text[^>]*variant="h3"/);
      expect(activate).not.toMatch(/<Button[\s\S]*?<Text[^>]*variant="h3"/);
      expect(resetPassword).not.toMatch(
        /<Button[\s\S]*?<Text[^>]*variant="h3"/,
      );
      expect(login).not.toMatch(/<Button[\s\S]*?<Text[^>]*variant="h3"/);
    });

    it("components/ui/pop-up.tsx respects Reduce Motion by bypassing confetti and spring physics", () => {
      const source = readSource("components/ui/pop-up.tsx");
      expect(source).toContain("isReduceMotionEnabled");
      expect(source).toContain("reduceMotion");
      expect(source).toContain("!reduceMotion &&");
      expect(source).toContain("accessibilityViewIsModal={true}");
      expect(source).toContain("Selesai");
      expect(source).toContain("Diproses dalam");
    });

    it("CameraAttendance.tsx and enroll.tsx announce lifecycle and validation events for accessibility", () => {
      const camera = readSource("app/attendance/CameraAttendance.tsx");
      const enroll = readSource("app/profile/enroll.tsx");

      expect(camera).toContain("AccessibilityInfo.announceForAccessibility");
      expect(camera).toContain("Kamera siap");
      expect(camera).toContain("Presensi berhasil");
      expect(camera).toContain('accessibilityRole="button"');

      expect(enroll).toContain("AccessibilityInfo.announceForAccessibility");
      expect(enroll).toContain("Kamera pendaftaran siap");
      expect(enroll).toContain("Pendaftaran wajah");
      expect(enroll).toContain('accessibilityRole="button"');
    });
  });

  describe("R3: Performance Optimization & Media Handling", () => {
    it("uses expo-image instead of react-native Image across all audit target files", () => {
      const files = [
        "components/ui/avatar.tsx",
        "app/profile/ManageAccount.tsx",
        "app/extra/pengaturan.tsx",
        "app/Dashboard.tsx",
        "app/auth/LoadingScreen.tsx",
        "app/auth/AuthSelector.tsx",
        "app/auth/callback.tsx",
        "app/perizinan/izin.tsx",
      ];

      for (const file of files) {
        const source = readSource(file);
        expect(source).toContain('from "expo-image"');
        expect(source).not.toMatch(
          /import\s*\{[^}]*Image[^}]*\}\s*from\s*["']react-native["']/,
        );
      }
    });

    it("app/perizinan/izin.tsx downscales photo attachments using expo-image-manipulator", () => {
      const source = readSource("app/perizinan/izin.tsx");
      expect(source).toContain('from "expo-image-manipulator"');
      expect(source).toContain("ImageManipulator.manipulateAsync");
      expect(source).toContain("1280");
      expect(source).toContain("compress: 0.7");
      expect(source).toContain("ImageManipulator.SaveFormat.JPEG");
    });

    it("app/perizinan/izin.tsx contains unsaved changes discard confirmation on back navigation", () => {
      const source = readSource("app/perizinan/izin.tsx");
      expect(source).toContain("Buang Pengajuan?");
      expect(source).toContain("Perubahan yang belum dikirim akan hilang.");
    });

    it("features/attendance-workflow/attendanceWorkflow.ts validates base64 in O(N) without backtracking regex", () => {
      const source = readSource(
        "features/attendance-workflow/attendanceWorkflow.ts",
      );
      // Must not contain catastrophic backtracking regex
      expect(source).not.toContain("(?:[A-Za-z0-9+/]{4})*");
      expect(source).toContain("BASE64_LOOKUP");

      // Verify correctness on valid and invalid payloads
      const validB64 = Buffer.from("test payload for attendance").toString(
        "base64",
      );
      expect(normalizeBase64(validB64)).toBe(validB64);
      expect(base64ByteSize(validB64)).toBe(
        Buffer.from("test payload for attendance").length,
      );

      // Verify rejection of invalid characters
      expect(normalizeBase64("invalid!characters@#")).toBeNull();
    });

    it("app/extra/riwayat.tsx and app/perizinan/status.tsx virtualize records with FlatList and getItemLayout", () => {
      const riwayat = readSource("app/extra/riwayat.tsx");
      const status = readSource("app/perizinan/status.tsx");

      expect(riwayat).toContain("<FlatList");
      expect(riwayat).toContain("getItemLayout={getItemLayout}");
      expect(riwayat).toContain("removeClippedSubviews={true}");

      expect(status).toContain("<FlatList");
      expect(status).toContain("getItemLayout=");

      const calendarSource = readSource(
        "components/attendance-calendar/index.tsx",
      );
      // Calendar when embedded must not wrap itself in ScrollView
      expect(calendarSource).not.toContain(
        '<ScrollView className="flex-1 px-4">',
      );
    });

    it("app/+not-found.tsx localizes copy to standard Indonesian and replaces hardcoded blue", () => {
      const source = readSource("app/+not-found.tsx");
      expect(source).not.toContain("ga ada, how?");
      expect(source).not.toContain("#2e78b7");
      expect(source).toContain("Halaman Tidak Ditemukan");
      expect(source).toContain("Kembali ke Beranda");
      expect(source).toContain("text-primary");
    });
  });
});
