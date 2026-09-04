import React, { memo } from "react";
import { View } from "react-native";
import { Text } from "~/components/ui/text";
import { CalendarDay } from "~/components/attendance-calendar/types";

interface CalendarDayComponentProps {
  day?: CalendarDay | null;
  isDarkColorScheme: boolean;
}

const baseDayClass =
  "flex-1 aspect-square items-center justify-center m-1 rounded-full";

const getDayStatusClasses = (day: CalendarDay, isDark: boolean) => {
  if (!day.isCurrentMonth) return `${baseDayClass} opacity-0`;

  // Future dates: Flat, unaccented, disabled
  if (day.isFuture) {
    return `${baseDayClass} opacity-30`;
  }

  // Today without attendance: Clear primary accent ring
  if (day.isToday && !day.attendance) {
    return `${baseDayClass} border-2 border-primary bg-primary/10`;
  }

  // Days without attendance record: Flat, unaccented
  if (!day.attendance) return baseDayClass;

  const hasCompleteAttendance =
    !!day.attendance.checkInTime && !!day.attendance.checkOutTime;

  // Present or Late
  if (day.attendance.status === "present" || day.attendance.status === "late") {
    const completeClass = isDark ? "bg-emerald-700/70" : "bg-emerald-400/50";
    const partialClass = isDark ? "bg-emerald-900/30" : "bg-emerald-100/70";
    const todayBorder = day.isToday ? "border-2 border-primary" : "";
    return `${baseDayClass} ${hasCompleteAttendance ? completeClass : partialClass} ${todayBorder}`.trim();
  }

  // Leave / Permit
  if (day.attendance.status === "leave") {
    const todayBorder = day.isToday ? "border-2 border-primary" : "";
    return `${baseDayClass} ${isDark ? "bg-blue-900/60" : "bg-blue-50"} ${todayBorder}`.trim();
  }

  // Sick / Absent
  const todayBorder = day.isToday ? "border-2 border-primary" : "";
  return `${baseDayClass} ${isDark ? "bg-rose-900/60" : "bg-rose-50"} ${todayBorder}`.trim();
};

const getDayTextClasses = (day: CalendarDay, isDark: boolean) => {
  if (!day.isCurrentMonth) return "text-transparent";

  // Future dates: Muted, disabled typography
  if (day.isFuture) {
    return "text-sm font-normal text-muted-foreground/40";
  }

  const baseText = "text-sm font-semibold";

  if (!day.attendance) {
    if (day.isToday) {
      return `${baseText} text-primary font-bold`;
    }
    return `${baseText} ${isDark ? "text-muted-foreground" : "text-foreground"}`;
  }

  switch (day.attendance.status) {
    case "present":
      return `${baseText} text-emerald-600 dark:text-emerald-400`;
    case "late":
      return `${baseText} text-orange-600 dark:text-orange-400`;
    case "leave":
      return `${baseText} text-blue-600 dark:text-blue-400`;
    case "sick":
    default:
      return `${baseText} text-rose-600 dark:text-rose-400`;
  }
};

export const CalendarDayComponent = memo(
  ({ day, isDarkColorScheme }: CalendarDayComponentProps) => {
    if (!day) {
      return <View className="flex-1 aspect-square m-1" />;
    }

    return (
      <View className={getDayStatusClasses(day, isDarkColorScheme)}>
        <Text className={getDayTextClasses(day, isDarkColorScheme)}>
          {day.date}
        </Text>

        {day.isToday && !day.attendance && (
          <View className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </View>
    );
  },
);

CalendarDayComponent.displayName = "CalendarDayComponent";
