import { CalendarDay } from "./types";

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
  const today = new Date();
  const todayString = formatDate(today);

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
