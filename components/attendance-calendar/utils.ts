import { AttendanceMap, CalendarDay, AttendanceStatus } from "./types";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";

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
  const startDate = firstDay.getDay();
  const gridSize = 42;

  const days: CalendarDay[] = [];
  const todayUTC = timeSync.getSyncedTime();
  const todayString = formatDateWIB(todayUTC);

  const prevMonth = new Date(year, month, 0);
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

  const remainingDays = gridSize - days.length;
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

interface RawAttendanceRecord {
  id: string;
  date: string;
  status: string;
  photo_url?: string;
  created_at?: string;
}

interface RawLeaveRecord {
  id: string;
  tanggal: string;
  kategori_izin: string;
  deskripsi?: string;
  link_foto?: string;
  approval_status?: "pending" | "approved" | "rejected" | null;
}

const ABSENT_STATUSES = new Set(["Alpha", "absent"]);
const CHECK_IN_STATUSES = new Set(["Hadir", "Terlambat", "present", "late"]);
const CHECK_OUT_STATUSES = new Set(["Pulang", "home"]);
const LATE_STATUSES = new Set(["Terlambat", "late"]);
const LEAVE_STATUSES = new Set(["leave", "sick"]);

const normalizeDateKey = (value: string) =>
  value.includes("T") ? value.slice(0, 10) : value;

const normalizeLeaveStatus = (value: string): AttendanceStatus =>
  value === "sakit" ? "sick" : "leave";

export const processAttendanceData = (
  attendanceRecords: RawAttendanceRecord[] | null,
  leaveRecords: RawLeaveRecord[] | null,
): AttendanceMap => {
  const processedData: AttendanceMap = {};

  const attendanceByDate: Record<string, RawAttendanceRecord[]> = {};
  attendanceRecords?.forEach((record) => {
    const dateKey = normalizeDateKey(record.date);
    if (!attendanceByDate[dateKey]) attendanceByDate[dateKey] = [];
    attendanceByDate[dateKey].push(record);
  });

  Object.entries(attendanceByDate).forEach(([date, records]) => {
    const firstRecord = records[0];
    if (!firstRecord) return;

    const hasAbsent = records.some((r) => ABSENT_STATUSES.has(r.status));
    const hasLeave = records.some((r) => LEAVE_STATUSES.has(r.status));
    const checkInRecord = records.find((r) => CHECK_IN_STATUSES.has(r.status));
    const checkOutRecord = records.find((r) =>
      CHECK_OUT_STATUSES.has(r.status),
    );
    const isLate = records.some((r) => LATE_STATUSES.has(r.status));

    if (hasAbsent) {
      processedData[date] = {
        id: firstRecord.id,
        date,
        status: "absent",
        photo_url: firstRecord.photo_url,
      };
      return;
    }

    if (hasLeave) {
      const leaveStatus = records.some((r) => r.status === "sick")
        ? "sick"
        : "leave";
      processedData[date] = {
        id: firstRecord.id,
        date,
        status: leaveStatus,
        photo_url: firstRecord.photo_url,
      };
      return;
    }

    if (checkInRecord || checkOutRecord) {
      processedData[date] = {
        id: firstRecord.id,
        date,
        status: isLate ? "late" : "present",
        checkInTime: checkInRecord?.created_at,
        checkOutTime: checkOutRecord?.created_at,
        photo_url: firstRecord.photo_url,
        isLate,
      };
    }
  });

  leaveRecords?.forEach((leave) => {
    if (leave.approval_status === "rejected") return;

    const dateKey = normalizeDateKey(leave.tanggal);
    processedData[dateKey] = {
      id: leave.id,
      date: dateKey,
      status: normalizeLeaveStatus(leave.kategori_izin),
      leaveType: leave.kategori_izin,
      description: leave.deskripsi,
      photo_url: leave.link_foto,
      approval_status: leave.approval_status ?? undefined,
    };
  });

  return processedData;
};
