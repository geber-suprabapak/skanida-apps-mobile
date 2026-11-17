import { formatAttendanceDateLabel, formatDateWIB } from "~/lib/utils";
import { resolveAbsenceStatusMeta } from "~/utils/absenceStatus";

describe("QA regression tests (mobile)", () => {
  it("BUG-MOB-03: resolves a defined amber color class when attendance status is Terlambat", () => {
    const meta = resolveAbsenceStatusMeta({
      isLoading: false,
      errorMessage: null,
      status: {
        actionable: true,
        action_type: "check_in",
        message: "Absensi terlambat tercatat.",
        details: {
          location_name: "SMKN 2 Magelang",
          status: "Terlambat",
        },
      },
    });

    expect(meta.iconName).toBe("clock");
    expect(meta.color).toBe("text-amber-600 dark:text-amber-500");

    const onTime = resolveAbsenceStatusMeta({
      isLoading: false,
      errorMessage: null,
      status: {
        actionable: true,
        action_type: "check_in",
        message: "Tepat waktu.",
      },
    });
    expect(onTime.iconName).toBe("check-circle");
    expect(onTime.color).toBe("text-green-600 dark:text-green-500");

    const loading = resolveAbsenceStatusMeta({
      isLoading: true,
      errorMessage: null,
      status: null,
    });
    expect(loading.iconName).toBe("loader");
    expect(loading.color).toBe("text-blue-600 dark:text-blue-500");

    const errorMeta = resolveAbsenceStatusMeta({
      isLoading: false,
      errorMessage: "Lokasi tidak tersedia",
      status: null,
    });
    expect(errorMeta.iconName).toBe("map-pin-off");
    expect(errorMeta.color).toBe("text-red-600 dark:text-red-500");
  });

  it("BUG-MOB-04: formats attendance history dates in Indonesian locale instead of raw YYYY-MM-DD", () => {
    expect(formatAttendanceDateLabel("2026-11-18")).toBe("18 Nov 2026");
    expect(formatAttendanceDateLabel("2026-11-17T17:00:00.000Z")).toBe(
      "18 Nov 2026",
    );
    expect(formatAttendanceDateLabel("2026-01-05")).toBe("5 Jan 2026");
    expect(formatAttendanceDateLabel("")).toBe("");
    expect(formatAttendanceDateLabel("not-a-date")).toBe("not-a-date");
    expect(formatDateWIB(new Date("2026-11-17T17:00:00.000Z"))).toBe(
      "2026-11-18",
    );
  });
});
