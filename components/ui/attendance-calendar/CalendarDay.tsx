import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "~/components/ui/text";
import { CalendarDayComponentProps } from "~/components/ui/attendance-calendar/types";

export const CalendarDayComponent = ({
  day,
  isDarkColorScheme,
  onPress,
  isSelected,
}: CalendarDayComponentProps) => {
  // Safety check for day prop
  if (!day) {
    return (
      <View className="flex-1 h-12 items-center justify-center m-0.5 rounded-lg bg-transparent">
        <Text className="text-sm text-gray-400">-</Text>
      </View>
    );
  }

  const getStatusClasses = () => {
    // Basic shape and layout
    const base = "flex-1 aspect-square items-center justify-center m-1 rounded-full";

    // Future dates in current month
    if (day.isCurrentMonth && day.isFuture) {
      return `${base} ${isDarkColorScheme ? "bg-gray-800/50" : "bg-gray-50"}`;
    }

    // Dates outside current month
    if (!day.isCurrentMonth) {
      return `${base} opacity-0`; // Hide or make very subtle
    }

    // Selection State (Ring)
    const selectionClass = isSelected
      ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-background"
      : "";

    if (!day.attendance) {
      // Absent if it's a past date (and not future)
      // This logic might need adjustment based on how 'absent' is typically handled in your app
      // For now, assuming only explicitly 'present'/'leave'/'sick' records exist.
      // If a day is past and no record => it might be weekend or holiday.
      // Keeping it simple: transparent unless specific status
      return `${base} ${selectionClass}`;
    }

    switch (day.attendance.status) {
      case "present":
        return `${base} ${isDarkColorScheme ? "bg-emerald-900/60" : "bg-emerald-50"} ${selectionClass}`;
      case "leave":
        return `${base} ${isDarkColorScheme ? "bg-blue-900/60" : "bg-blue-50"} ${selectionClass}`;
      case "sick":
        return `${base} ${isDarkColorScheme ? "bg-rose-900/60" : "bg-rose-50"} ${selectionClass}`;
      default: // alpha/absent
        return `${base} ${isDarkColorScheme ? "bg-rose-900/60" : "bg-rose-50"} ${selectionClass}`;
    }
  };

  const getTextClasses = () => {
    // Outside month
    if (!day.isCurrentMonth) return "text-transparent";
    
    // Future
    if (day.isFuture) return isDarkColorScheme ? "text-muted-foreground" : "text-gray-300";

    const baseText = "text-sm font-semibold";
    
    if (!day.attendance) {
      // Normal day text
      const todayClass = day.isToday ? "text-blue-600 dark:text-blue-400 font-bold" : isDarkColorScheme ? "text-gray-300" : "text-gray-700";
       return `${baseText} ${todayClass}`;
    }

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

  if (!day) {
     return <View className="flex-1 aspect-square m-1" />;
  }

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
