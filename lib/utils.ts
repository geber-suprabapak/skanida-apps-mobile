import { clsx, type ClassValue } from "clsx";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert UTC Date to WIB (UTC+7) for DISPLAY ONLY
 * DO NOT use for database operations
 */
export function toWIB(utcDate: Date): Date {
  return new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);
}

/**
 * Format date as YYYY-MM-DD in WIB timezone
 * Used for database queries that expect WIB dates
 */
export function formatDateWIB(date: Date): string {
  const wibDate = toWIB(date);
  const year = wibDate.getUTCFullYear();
  const month = String(wibDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format an attendance date string (YYYY-MM-DD or ISO timestamp) in Indonesian locale.
 */
export function formatAttendanceDateLabel(dateValue: string): string {
  if (!dateValue) return "";
  let dateKey = dateValue;
  if (dateValue.includes("T")) {
    const rawDate = new Date(dateValue);
    if (Number.isNaN(rawDate.getTime())) return dateValue;
    dateKey = formatDateWIB(rawDate);
  }
  const parsed = parseISO(dateKey);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return format(parsed, "d MMM yyyy", { locale: idLocale });
}

export type WIBDayBounds = {
  start: string;
  endExclusive: string;
};

/**
 * Build an inclusive-exclusive UTC range that matches a calendar day in WIB.
 */
export function getWIBDayBounds(date: Date): WIBDayBounds {
  const wibDate = toWIB(date);
  const year = wibDate.getUTCFullYear();
  const month = wibDate.getUTCMonth();
  const day = wibDate.getUTCDate();

  const start = new Date(Date.UTC(year, month, day, -7, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(year, month, day + 1, -7, 0, 0, 0));

  return {
    start: start.toISOString(),
    endExclusive: endExclusive.toISOString(),
  };
}
