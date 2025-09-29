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

  const getStatusColor = () => {
    // Future dates in current month should be greyed out but distinct from next month
    if (day.isCurrentMonth && day.isFuture) {
      return isDarkColorScheme ? "bg-gray-800" : "bg-gray-50";
    }

    // Previous/next month dates (outside current month)
    if (!day.isCurrentMonth) {
      return "bg-transparent";
    }

    if (!day.attendance) {
      return isDarkColorScheme ? "bg-red-900" : "bg-red-100";
    }

    switch (day.attendance.status) {
      case "present":
        return isDarkColorScheme ? "bg-green-900" : "bg-green-100";
      case "leave":
        return isDarkColorScheme ? "bg-blue-900" : "bg-blue-100";
      case "sick":
        return isDarkColorScheme ? "bg-yellow-900" : "bg-yellow-100";
      default:
        return isDarkColorScheme ? "bg-red-900" : "bg-red-100";
    }
  };

  const getTextColor = () => {
    // Previous/next month dates (outside current month) - very faded
    if (!day.isCurrentMonth) {
      return isDarkColorScheme ? "text-gray-600" : "text-gray-400";
    }

    // Future dates in current month - greyed out but readable
    if (day.isCurrentMonth && day.isFuture) {
      return isDarkColorScheme ? "text-gray-500" : "text-gray-500";
    }

    // Today's date text color
    if (day.isToday) {
      return isDarkColorScheme
        ? "text-pink-400 font-semibold"
        : "text-pink-600 font-semibold";
    }

    if (!day.attendance) {
      return isDarkColorScheme ? "text-red-400" : "text-red-600";
    }

    switch (day.attendance.status) {
      case "present":
        return isDarkColorScheme ? "text-green-400" : "text-green-700";
      case "leave":
        return isDarkColorScheme ? "text-blue-400" : "text-blue-700";
      case "sick":
        return isDarkColorScheme ? "text-yellow-400" : "text-yellow-700";
      default:
        return isDarkColorScheme ? "text-red-400" : "text-red-600";
    }
  };

  const getBorderAndBackground = () => {
    // Today's date gets a pink border indicator
    if (day.isToday) {
      return isDarkColorScheme
        ? "border-2 border-pink-400"
        : "border-2 border-pink-500";
    }

    // Default border
    return isDarkColorScheme
      ? "border border-gray-600"
      : "border border-gray-200";
  };

  const handlePress = () => {
    try {
      if (!day?.isCurrentMonth) {
        console.log("Day is not in current month, press ignored");
        return;
      }

      // Prevent interaction with future dates
      if (day.isFuture) {
        console.log("Future date clicked, press ignored");
        return;
      }

      if (typeof onPress === "function") {
        onPress();
      } else {
        console.warn("onPress is not a function");
      }
    } catch (error) {
      console.error("Error in day press handler:", error);
    }
  };

  const getButtonClassName = () => {
    const baseClasses =
      "flex-1 h-12 items-center justify-center m-0.5 rounded-lg";
    const statusColor = getStatusColor();
    const borderAndBackground = getBorderAndBackground();
    const selectionBorder = isSelected
      ? isDarkColorScheme
        ? "border-green-400"
        : "border-green-500"
      : "";

    return `${baseClasses} ${statusColor} ${borderAndBackground} ${selectionBorder}`;
  };

  return (
    <TouchableOpacity
      className={getButtonClassName()}
      onPress={handlePress}
      disabled={!day.isCurrentMonth || day.isFuture}
      activeOpacity={day.isCurrentMonth && !day.isFuture ? 0.7 : 1}
      style={{ minHeight: 48 }}
    >
      <Text className={`text-sm ${getTextColor()}`}>{day.date}</Text>

      {/* Attendance indicator dot */}
      {day.attendance && day.isCurrentMonth && (
        <View className="absolute bottom-1 w-1 h-1 rounded-full bg-current" />
      )}

      {/* Today indicator - small dot at top-right */}
      {day.isToday && (
        <View
          className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
            isDarkColorScheme ? "bg-pink-400" : "bg-pink-500"
          }`}
        />
      )}
    </TouchableOpacity>
  );
};
