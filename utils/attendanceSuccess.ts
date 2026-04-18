export type PendingAttendanceSuccess = {
  attendanceType: "check_in" | "check_out";
  processingTime: number;
};

let pendingAttendanceSuccess: PendingAttendanceSuccess | null = null;

export const setPendingAttendanceSuccess = (
  value: PendingAttendanceSuccess,
) => {
  pendingAttendanceSuccess = value;
};

export const consumePendingAttendanceSuccess =
  (): PendingAttendanceSuccess | null => {
    const value = pendingAttendanceSuccess;
    pendingAttendanceSuccess = null;
    return value;
  };
