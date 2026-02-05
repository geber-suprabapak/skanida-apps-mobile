export interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "leave" | "sick" | "late";
  checkInTime?: string;
  checkOutTime?: string;
  leaveType?: string;
  description?: string;
  photo_url?: string;
  approval_status?: "pending" | "approved" | "rejected";
  isLate?: boolean;
}

export interface CalendarDay {
  date: number;
  fullDate: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  attendance?: AttendanceRecord;
}

export interface AttendanceCalendarProps {
  isDarkColorScheme: boolean;
  currentYear?: number;
  currentMonth?: number;
}

export interface AttendanceCalendarRef {
  refetch: (forceRefresh?: boolean) => Promise<void>;
}
