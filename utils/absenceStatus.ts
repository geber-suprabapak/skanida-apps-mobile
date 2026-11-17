import type { MobileAttendanceAction } from "~/utils/bffMobileApi";

export type AbsenceStatusIconName =
  | "loader"
  | "map-pin-off"
  | "clock"
  | "check-circle"
  | "help-circle";

export type AbsenceStatusMeta = {
  iconName: AbsenceStatusIconName;
  color: string;
  message: string;
};

export type ResolveAbsenceStatusInput = {
  isLoading: boolean;
  errorMessage: string | null;
  status: MobileAttendanceAction | null;
};

export function resolveAbsenceStatusMeta(
  input: ResolveAbsenceStatusInput,
): AbsenceStatusMeta {
  const { isLoading, errorMessage, status } = input;

  if (isLoading) {
    return {
      iconName: "loader",
      color: "text-blue-600 dark:text-blue-500",
      message: "Memeriksa Status...",
    };
  }

  if (errorMessage) {
    return {
      iconName: "map-pin-off",
      color: "text-red-600 dark:text-red-500",
      message: errorMessage,
    };
  }

  if (status?.actionable) {
    if (status.details?.status === "Terlambat") {
      return {
        iconName: "clock",
        color: "text-amber-600 dark:text-amber-500",
        message: status.message,
      };
    }
    return {
      iconName: "check-circle",
      color: "text-green-600 dark:text-green-500",
      message: status.message,
    };
  }

  return {
    iconName: "help-circle",
    color: "text-blue-600 dark:text-blue-500",
    message: status?.message || "Status Tidak Diketahui",
  };
}
