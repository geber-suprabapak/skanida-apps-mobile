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

  if (day.isCurrentMonth && day.isFuture) {
    return `${baseDayClass} ${isDark ? "bg-muted/50" : "bg-muted"}`;
  }

  if (!day.attendance) return baseDayClass;

  const hasCompleteAttendance =
    !!day.attendance.checkInTime && !!day.attendance.checkOutTime;

  if (day.attendance.status === "present" || day.attendance.status === "late") {
    const completeClass = isDark ? "bg-emerald-700/70" : "bg-emerald-400/50";
    const partialClass = isDark ? "bg-emerald-900/30" : "bg-emerald-100/70";
    return `${baseDayClass} ${hasCompleteAttendance ? completeClass : partialClass}`;
  }

  if (day.attendance.status === "leave") {
    return `${baseDayClass} ${isDark ? "bg-blue-900/60" : "bg-blue-50"}`;
  }

  if (day.attendance.status === "sick") {
    return `${baseDayClass} ${isDark ? "bg-rose-900/60" : "bg-rose-50"}`;
  }

  return `${baseDayClass} ${isDark ? "bg-rose-900/60" : "bg-rose-50"}`;
};

const getDayTextClasses = (day: CalendarDay, isDark: boolean) => {
  if (!day.isCurrentMonth) return "text-transparent";

  if (day.isFuture) {
    return "text-muted-foreground";
  }

  const baseText = "text-sm font-semibold";

  if (!day.attendance) {
    const todayClass = day.isToday
      ? "text-blue-600 dark:text-blue-400 font-bold"
      : isDark
        ? "text-muted-foreground"
        : "text-foreground";
    return `${baseText} ${todayClass}`;
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
          <View className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
        )}
      </View>
    );
  },
);

CalendarDayComponent.displayName = "CalendarDayComponent";
