export interface AttendanceRecord {
  id: string;
  date: string;
  status: "present" | "absent" | "leave" | "sick";
  checkInTime?: string;
  checkOutTime?: string;
  leaveType?: string;
  description?: string;
  photo_url?: string;
  approval_status?: "pending" | "approved" | "rejected";
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

export interface CalendarDayComponentProps {
  day: CalendarDay;
  isDarkColorScheme: boolean;
  onPress: () => void;
  isSelected: boolean;
}

export interface DetailCardProps {
  day: CalendarDay | null;
  isDarkColorScheme: boolean;
  onClose?: () => void;
}
