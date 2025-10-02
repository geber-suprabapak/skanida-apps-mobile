import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get current date/time in WIB timezone (UTC+7)
 * This ensures consistent timezone across the entire app
 */
export function getWIBDate(): Date {
  const now = new Date();
  const wibOffset = 7 * 60; // 7 hours in minutes
  const localOffset = now.getTimezoneOffset(); // device timezone offset in minutes
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60000);
  return wibTime;
}

/**
 * Format WIB date to YYYY-MM-DD string
 * Used for database queries and comparisons
 */
export function getWIBDateString(): string {
  const wibTime = getWIBDate();
  const year = wibTime.getUTCFullYear();
  const month = String(wibTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get WIB timestamp as ISO string
 */
export function getWIBISOString(): string {
  return new Date().toISOString(); // Keep as UTC for database
}
