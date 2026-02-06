import React, { memo } from "react";
import { View } from "react-native";
import { Text } from "~/components/ui/text";
import { CalendarDay } from "~/components/ui/attendance-calendar/types";

interface CalendarDayComponentProps {
  day: CalendarDay;
  isDarkColorScheme: boolean;
}

export const CalendarDayComponent = memo(
  ({ day, isDarkColorScheme }: CalendarDayComponentProps) => {
    // Safety check for day prop
    if (!day) {
      return <View className="flex-1 aspect-square m-1" />;
    }

    const getStatusClasses = () => {
      // Basic shape and layout
      const base =
        "flex-1 aspect-square items-center justify-center m-1 rounded-full";

      // Future dates in current month
      if (day.isCurrentMonth && day.isFuture) {
        return `${base} ${isDarkColorScheme ? "bg-gray-800/50" : "bg-gray-50"}`;
      }

      // Dates outside current month
      if (!day.isCurrentMonth) {
        return `${base} opacity-0`; // Hide or make very subtle
      }

      if (!day.attendance) {
        return base;
      }

      const hasCompleteAttendance =
        !!day.attendance?.checkInTime && !!day.attendance?.checkOutTime;

      switch (day.attendance.status) {
        case "present":
        case "late": {
          const completeClass = isDarkColorScheme
            ? "bg-emerald-700/70"
            : "bg-emerald-400/50";
          const partialClass = isDarkColorScheme
            ? "bg-emerald-900/30"
            : "bg-emerald-100/70";
          return `${base} ${hasCompleteAttendance ? completeClass : partialClass}`;
        }
        case "leave":
          return `${base} ${isDarkColorScheme ? "bg-blue-900/60" : "bg-blue-50"}`;
        case "sick":
          return `${base} ${isDarkColorScheme ? "bg-rose-900/60" : "bg-rose-50"}`;
        default: // alpha/absent
          return `${base} ${isDarkColorScheme ? "bg-rose-900/60" : "bg-rose-50"}`;
      }
    };

    const getTextClasses = () => {
      // Outside month
      if (!day.isCurrentMonth) return "text-transparent";

      // Future
      if (day.isFuture)
        return isDarkColorScheme ? "text-muted-foreground" : "text-gray-300";

      const baseText = "text-sm font-semibold";

      if (!day.attendance) {
        // Normal day text
        const todayClass = day.isToday
          ? "text-blue-600 dark:text-blue-400 font-bold"
          : isDarkColorScheme
            ? "text-gray-300"
            : "text-gray-700";
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
          return `${baseText} text-rose-600 dark:text-rose-400`;
        default:
          return `${baseText} text-rose-600 dark:text-rose-400`;
      }
    };

    return (
      <View className={getStatusClasses()}>
        <Text className={getTextClasses()}>{day.date}</Text>

        {/* Today Indicator (Small Dot below text) */}
        {day.isToday && !day.attendance && (
          <View className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
        )}
      </View>
    );
  },
);

    switch (day.attendance.status) {
      case "present":
        return `${baseText} text-emerald-600 dark:text-emerald-400`;
      case "leave":
        return `${baseText} text-blue-600 dark:text-blue-400`;
      case "sick":
        return `${baseText} text-rose-600 dark:text-rose-400`;
      default:
        return `${baseText} text-rose-600 dark:text-rose-400`;
    }
  };

  const handlePress = () => {
    if (!day?.isCurrentMonth || day.isFuture) return;
    onPress?.();
  };

  return (
    <TouchableOpacity
      className={getStatusClasses()}
      onPress={handlePress}
      disabled={!day.isCurrentMonth || day.isFuture}
      activeOpacity={0.7}
    >
      <Text className={getTextClasses()}>{day.date}</Text>

      {/* Today Indicator (Small Dot below text) */}
      {day.isToday && !day.attendance && (
        <View className="absolute bottom-1 w-1 h-1 rounded-full bg-blue-500" />
      )}
    </TouchableOpacity>
  );
};
