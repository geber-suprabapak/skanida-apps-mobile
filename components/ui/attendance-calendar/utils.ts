import { CalendarDay, AttendanceRecord } from "./types";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";

/**
 * Format date to YYYY-MM-DD string
 * Note: Input date should already be in correct timezone context
 */
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatTime = (dateString: string): string => {
  if (!dateString || !dateString.includes("T")) return "N/A";
  return new Date(dateString).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

export const getMonthDays = (year: number, month: number): CalendarDay[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDate = firstDay.getDay(); // 0 = Sunday

  const days: CalendarDay[] = [];
  const todayUTC = timeSync.getSyncedTime();
  const todayString = formatDateWIB(todayUTC);

  // Add previous month's trailing days
  const prevMonth = new Date(year, month - 1, 0);
  for (let i = startDate - 1; i >= 0; i--) {
    const date = prevMonth.getDate() - i;
    const fullDate = formatDate(new Date(year, month - 1, date));
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: false,
      isToday: false,
      isFuture,
    });
  }

  // Add current month days
  for (let date = 1; date <= daysInMonth; date++) {
    const fullDate = formatDate(new Date(year, month, date));
    const isToday = fullDate === todayString;
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: true,
      isToday,
      isFuture,
    });
  }

  // Add next month's leading days to complete the week
  const remainingDays = 42 - days.length; // 6 weeks * 7 days
  for (let date = 1; date <= remainingDays; date++) {
    const fullDate = formatDate(new Date(year, month + 1, date));
    const isFuture = fullDate > todayString;
    days.push({
      date,
      fullDate,
      isCurrentMonth: false,
      isToday: false,
      isFuture,
    });
  }

  return days;
};

/** Raw attendance record from database */
interface RawAttendanceRecord {
  id: string;
  date: string;
  status: string;
  photo_url?: string;
  created_at?: string;
}

/** Raw leave record from database */
interface RawLeaveRecord {
  id: string;
  tanggal: string;
  kategori_izin: string;
  deskripsi?: string;
  link_foto?: string;
  approval_status?: "pending" | "approved" | "rejected";
}

/**
 * Process raw attendance and leave records into a unified AttendanceRecord map
 * Shared function to eliminate duplication between fetchFromServer and prefetchAdjacentMonths
 */
export const processAttendanceData = (
  attendanceRecords: RawAttendanceRecord[] | null,
  leaveRecords: RawLeaveRecord[] | null,
): Record<string, AttendanceRecord> => {
  const processedData: Record<string, AttendanceRecord> = {};

  // Group attendance records by date
  const attendanceByDate: Record<string, RawAttendanceRecord[]> = {};
  attendanceRecords?.forEach((record) => {
    if (!attendanceByDate[record.date]) {
      attendanceByDate[record.date] = [];
    }
    attendanceByDate[record.date].push(record);
  });

  // Process grouped attendance records
  Object.entries(attendanceByDate).forEach(([date, records]) => {
    const hasAlphaRecord = records.some((r) => r.status === "Alpha");
    const checkInRecord = records.find(
      (r) => r.status === "Hadir" || r.status === "Terlambat",
    );
    const checkOutRecord = records.find((r) => r.status === "Pulang");

    if (hasAlphaRecord) {
      processedData[date] = {
        id: records[0].id,
        date,
        status: "absent",
        photo_url: records[0].photo_url,
      };
    } else if (checkInRecord || checkOutRecord) {
      const isLate = checkInRecord?.status === "Terlambat";
      processedData[date] = {
        id: records[0].id,
        date,
        status: isLate ? "late" : "present",
        checkInTime: checkInRecord?.created_at,
        checkOutTime: checkOutRecord?.created_at,
        photo_url: records[0].photo_url,
        isLate,
      };
    }
  });

  // Process leave requests (these override attendance records)
  leaveRecords?.forEach((leave) => {
    const status = leave.kategori_izin === "sakit" ? "sick" : "leave";
    processedData[leave.tanggal] = {
      id: leave.id,
      date: leave.tanggal,
      status,
      leaveType: leave.kategori_izin,
      description: leave.deskripsi,
      photo_url: leave.link_foto,
      approval_status: leave.approval_status,
    };
  });

  return processedData;
};
