import { readFileSync } from "node:fs";
import { join } from "node:path";
import { processAttendanceData } from "../components/attendance-calendar/utils";
import type { BffAttendanceRecord, MobilePermit } from "../utils/bffMobileApi";

describe("Ticket 12 — Profile and Attendance History Invariants", () => {
  const rootDir = process.cwd();

  describe("Calendar and Profile Architecture Invariants", () => {
    it("ensures attendance-calendar hooks do not directly query Supabase tables", () => {
      const hooksPath = join(
        rootDir,
        "components/attendance-calendar/hooks.ts",
      );
      const content = readFileSync(hooksPath, "utf8");

      expect(content).not.toContain("supabase");
      expect(content).not.toContain('.from("absences")');
      expect(content).not.toContain('.from("perizinan")');
      expect(content).toContain("listAttendances");
      expect(content).toContain("listPermits");
    });

    it("ensures authStore fetches profile from Astra BFF without direct Supabase user_profiles table access", () => {
      const storePath = join(rootDir, "store/authStore.ts");
      const content = readFileSync(storePath, "utf8");

      expect(content).not.toContain('.from("user_profiles")');
      expect(content).toContain("getProfile");
    });

    it("ensures ManageAccount and riwayat use Astra BFF rather than direct Supabase profile queries", () => {
      const managePath = join(rootDir, "app/profile/ManageAccount.tsx");
      const manageContent = readFileSync(managePath, "utf8");
      expect(manageContent).not.toContain('.from("user_profiles")');
      expect(manageContent).not.toContain('.from("absences")');

      const riwayatPath = join(rootDir, "app/extra/riwayat.tsx");
      const riwayatContent = readFileSync(riwayatPath, "utf8");
      expect(riwayatContent).not.toContain("supabase");
    });

    it("ensures bffMobileApi exposes listAttendances, getProfile, and listPermits", () => {
      const bffPath = join(rootDir, "utils/bffMobileApi.ts");
      const content = readFileSync(bffPath, "utf8");

      expect(content).toContain("export async function listAttendances");
      expect(content).toContain("export async function getProfile");
      expect(content).toContain("export async function listPermits");
    });
  });

  describe("processAttendanceData domain mapping", () => {
    it("correctly aggregates present and late attendance records", () => {
      const attendances: BffAttendanceRecord[] = [
        {
          id: "att-1",
          user_id: "student-1",
          date: "2026-08-01",
          status: "Hadir",
          created_at: "2026-08-01T07:00:00.000Z",
        },
        {
          id: "att-2",
          user_id: "student-1",
          date: "2026-08-02",
          status: "Terlambat",
          created_at: "2026-08-02T07:45:00.000Z",
        },
      ];

      const result = processAttendanceData(attendances, []);

      expect(result["2026-08-01"]).toBeDefined();
      expect(result["2026-08-01"].status).toBe("present");
      expect(result["2026-08-01"].checkInTime).toBe("2026-08-01T07:00:00.000Z");

      expect(result["2026-08-02"]).toBeDefined();
      expect(result["2026-08-02"].status).toBe("late");
      expect(result["2026-08-02"].isLate).toBe(true);
    });

    it("correctly maps approved and pending leave requests", () => {
      const permits: MobilePermit[] = [
        {
          id: "permit-1",
          kategori_izin: "sakit",
          deskripsi: "Demam tinggi",
          approval_status: "approved",
          tanggal: "2026-08-03",
          created_at: "2026-08-03T06:00:00.000Z",
        },
        {
          id: "permit-2",
          kategori_izin: "izin",
          deskripsi: "Acara keluarga",
          approval_status: "pending",
          tanggal: "2026-08-04",
          created_at: "2026-08-04T06:00:00.000Z",
        },
        {
          id: "permit-3",
          kategori_izin: "pergi",
          deskripsi: "Lomba",
          approval_status: "rejected",
          tanggal: "2026-08-05",
          created_at: "2026-08-05T06:00:00.000Z",
        },
      ];

      const result = processAttendanceData(null, permits);

      expect(result["2026-08-03"]).toBeDefined();
      expect(result["2026-08-03"].status).toBe("sick");
      expect(result["2026-08-03"].approval_status).toBe("approved");

      expect(result["2026-08-04"]).toBeDefined();
      expect(result["2026-08-04"].status).toBe("leave");
      expect(result["2026-08-04"].approval_status).toBe("pending");

      // Rejected leaves must be omitted from calendar representation
      expect(result["2026-08-05"]).toBeUndefined();
    });
  });
});
