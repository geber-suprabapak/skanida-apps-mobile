import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Interface untuk hasil pengecekan waktu absensi
 */
export interface AttendanceTimeResult {
  canCheckIn: boolean;
  canCheckOut: boolean;
}

/**
 * Fungsi untuk mengecek apakah waktu saat ini berada dalam rentang jam absen
 * Berdasarkan jadwal sekolah yang berbeda untuk setiap hari
 *
 * @param date - Tanggal dan waktu yang akan dicek (default: waktu sekarang)
 * @returns Object dengan boolean canCheckIn dan canCheckOut
 */
export function checkAttendanceTime(
  date: Date = new Date(),
): AttendanceTimeResult {
  // Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = date.getDay();

  // Get current time in hours and minutes
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Skip weekends (Saturday = 6, Sunday = 0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { canCheckIn: false, canCheckOut: false };
  }

  let checkInStart: number,
    checkInEnd: number,
    checkOutStart: number,
    checkOutEnd: number;

  // Define schedule based on day of week
  if (dayOfWeek === 1) {
    // Senin
    checkInStart = timeToMinutes("07:00");
    checkInEnd = timeToMinutes("08:00");
    checkOutStart = timeToMinutes("15:00");
    checkOutEnd = timeToMinutes("16:00");
  } else if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    // Selasa - Kamis
    checkInStart = timeToMinutes("07:00");
    checkInEnd = timeToMinutes("08:00");
    checkOutStart = timeToMinutes("14:00");
    checkOutEnd = timeToMinutes("15:00");
  } else if (dayOfWeek === 5) {
    // Jumat
    checkInStart = timeToMinutes("07:00");
    checkInEnd = timeToMinutes("08:00");
    checkOutStart = timeToMinutes("11:30");
    checkOutEnd = timeToMinutes("12:30");
  } else {
    // Default case (shouldn't happen for weekdays)
    return { canCheckIn: false, canCheckOut: false };
  }

  // Check if current time is within check-in or check-out periods
  const canCheckIn =
    currentTimeInMinutes >= checkInStart && currentTimeInMinutes <= checkInEnd;
  const canCheckOut =
    currentTimeInMinutes >= checkOutStart &&
    currentTimeInMinutes <= checkOutEnd;

  return { canCheckIn, canCheckOut };
}
