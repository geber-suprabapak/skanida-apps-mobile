import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 3 design harmonization contracts", () => {
  it("keeps Electric Blue as the shared primary token in both themes", () => {
    const css = source("global.css");

    expect(css.match(/--color-primary: hsl\(216 100% 50%\)/g)).toHaveLength(2);
    expect(
      css.match(/--color-primary-foreground: hsl\(0 0% 100%\)/g),
    ).toHaveLength(2);
  });

  it("reserves the Dashboard's dark hero for the Digital Student Pass and uses neutral shortcuts", () => {
    const dashboard = source("app/Dashboard.tsx");

    expect(dashboard).toContain("bg-slate-900 rounded-2xl");
    expect(dashboard).toContain(
      "bg-secondary flex-row items-center justify-center",
    );
    expect(dashboard).not.toContain("bg-blue-600");
    expect(dashboard).not.toContain("rounded-[35px]");
  });

  it("uses border-first history cards and semantic attendance badges", () => {
    const history = source("app/extra/riwayat.tsx");

    expect(history).not.toContain("border-[3px]");
    expect(history).not.toMatch(/bg-white|gray-[0-9]+/);
    for (const variant of ["hadir", "terlambat", "izin", "sakit"]) {
      expect(history).toContain(`variant="${variant}"`);
    }
  });

  it("keeps form and alert surfaces readable in dark mode", () => {
    const activate = source("app/auth/Activate.tsx");
    const permits = source("app/perizinan/izin.tsx");

    expect(activate).not.toMatch(/bg-white|gray-[0-9]+/);
    expect(permits).toContain("dark:bg-orange-950/40");
    expect(permits).toContain("dark:bg-red-950/40");
    expect(permits).toContain("dark:bg-green-950/40");
    expect(permits).toContain("dark:bg-indigo-950/40");
  });

  it("does not retain raw gray Tailwind utilities in app or shared components", () => {
    const files = [
      "app/_layout.tsx",
      "app/Dashboard.tsx",
      "app/attendance/AbsenceReport.tsx",
      "app/attendance/CameraAttendance.tsx",
      "app/auth/Activate.tsx",
      "app/auth/AuthSelector.tsx",
      "app/auth/Login.tsx",
      "app/auth/ResetPassword.tsx",
      "app/auth/callback.tsx",
      "app/extra/pengaturan.tsx",
      "app/extra/riwayat.tsx",
      "app/perizinan/izin.tsx",
      "app/perizinan/status.tsx",
      "app/profile/ManageAccount.tsx",
      "app/profile/enroll.tsx",
      "components/TimeSyncIndicator.tsx",
      "components/attendance-calendar/CalendarDay.tsx",
      "components/attendance-calendar/index.tsx",
      "components/ui/input.tsx",
      "components/ui/month-year-picker.tsx",
      "components/ui/pop-up.tsx",
    ];

    for (const path of files) {
      expect(source(path)).not.toMatch(/gray-[0-9]+/);
    }
  });
});
