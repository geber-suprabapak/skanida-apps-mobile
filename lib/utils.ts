import { clsx, type ClassValue } from "clsx";
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
