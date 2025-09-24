import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { Text } from "~/components/ui/text";
import MonthYearPicker from "~/components/ui/month-year-picker";
import useAuthStore from "~/store/authStore";

import { CalendarDayComponent } from "~/components/ui/attendance-calendar/CalendarDay";
import { DetailCard } from "~/components/ui/attendance-calendar/DetailCard";
import { useOptimizedMonthlyAttendance } from "~/components/ui/attendance-calendar/hooks";
import {
  getMonthDays,
  formatTime,
} from "~/components/ui/attendance-calendar/utils";
import {
  CalendarDay,
  AttendanceCalendarProps,
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar/types";
import { RefreshCw } from "lucide-react-native";
import { Icon } from "~/components/ui/icon";
const AttendanceCalendar = forwardRef<
  AttendanceCalendarRef,
  AttendanceCalendarProps
>(
  (
    { isDarkColorScheme, currentYear: propYear, currentMonth: propMonth },
    ref,
  ) => {
    const user = useAuthStore((state: any) => state.user);
    const [detailDay, setDetailDay] = useState<CalendarDay | null>(null);
    const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

    // Date picker state
    const [pickerDate, setPickerDate] = useState(new Date());

    // Use props if provided, otherwise use current date
    const currentDate =
      propYear && propMonth !== undefined
        ? new Date(propYear, propMonth, 1)
        : new Date();
    const currentYear = propYear || currentDate.getFullYear();
    const currentMonth =
      propMonth !== undefined ? propMonth : currentDate.getMonth();

    // Use props if provided, otherwise use internal date picker
    const displayYear =
      propYear !== undefined ? propYear : pickerDate.getFullYear();
    const displayMonth =
      propMonth !== undefined ? propMonth : pickerDate.getMonth();

    // Fetch monthly attendance data with optimized caching
    const monthlyAttendance = useOptimizedMonthlyAttendance(
      user?.id || "",
      displayYear,
      displayMonth,
    );

    // Expose refetch method via ref
    useImperativeHandle(
      ref,
      () => ({
        refetch: (forceRefresh: boolean = false) => {
          if (user?.id && typeof monthlyAttendance.refetch === "function") {
            return monthlyAttendance.refetch(forceRefresh);
          }
          return Promise.resolve();
        },
      }),
      [user?.id, monthlyAttendance],
    );

    // Generate calendar days
    const calendarDays = useMemo(() => {
      try {
        const days = getMonthDays(displayYear, displayMonth);
        return days.map((day) => ({
          ...day,
          attendance: monthlyAttendance.data?.[day.fullDate],
        }));
      } catch (error) {
        console.error("Error generating calendar days:", error);
        return [];
      }
    }, [displayYear, displayMonth, monthlyAttendance.data]);

    const handleDayPress = useCallback((day: CalendarDay) => {
      try {
        // Only allow clicks on current month days
        if (!day?.isCurrentMonth) {
          console.log(
            `🚫 Day ${day?.date} not in current month, ignoring press`,
          );
          return;
        }

        console.log(`📅 Date clicked: ${day.fullDate}`);

        if (day.attendance) {
          console.log(`✅ Attendance found: ${day.attendance.status}`);
          if (day.attendance.checkInTime) {
            console.log(
              `🕒 Check-in time: ${formatTime(day.attendance.checkInTime)}`,
            );
          }
          if (day.attendance.checkOutTime) {
            console.log(
              `🕕 Check-out time: ${formatTime(day.attendance.checkOutTime)}`,
            );
          }
        } else {
          console.log(`❌ No attendance record found for ${day.fullDate}`);
        }

        setDetailDay(day);
        setSelectedDay(day);
      } catch (error) {
        console.error("Error in handleDayPress:", error);
        console.warn("Failed to show date details, please try again");
      }
    }, []);

    // Effects
    useEffect(() => {
      try {
        if (user?.id && typeof monthlyAttendance.refetch === "function") {
          // Fetch current month data
          monthlyAttendance.refetch(false);

          // Prefetch adjacent months after a short delay
          const prefetchTimer = setTimeout(() => {
            if (typeof monthlyAttendance.prefetchAdjacent === "function") {
              monthlyAttendance.prefetchAdjacent();
            }
          }, 1000);

          return () => clearTimeout(prefetchTimer);
        } else {
          console.warn(
            "Unable to refetch attendance data - missing user ID or refetch function",
          );
        }
      } catch (error) {
        console.error("Error refetching attendance data:", error);
      }
    }, [displayYear, displayMonth, user?.id, monthlyAttendance]);

    // Clear selected day when month changes
    useEffect(() => {
      setDetailDay(null);
      setSelectedDay(null);
    }, [displayYear, displayMonth]);

    // Handle manual refresh
    const handleRefresh = useCallback(() => {
      try {
        if (user?.id && typeof monthlyAttendance.refetch === "function") {
          monthlyAttendance.refetch(true); // Force refresh
        }
      } catch (error) {
        console.error("Error refreshing data:", error);
      }
    }, [user?.id, monthlyAttendance]);

    // Date picker handlers (if not using props)
    const handleDateChange = useCallback((date: Date) => {
      setPickerDate(date);
    }, []);

    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

    return (
      <ScrollView className="flex-1 px-4">
        {/* Month/Year Selector - only show if no props provided */}
        {propYear === undefined && propMonth === undefined && (
          <View
            className={`mb-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"} rounded-lg p-4`}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className={`text-lg font-semibold ${
                  isDarkColorScheme ? "text-white" : "text-foreground"
                }`}
              >
                Pilih Periode
              </Text>
              <TouchableOpacity
                onPress={handleRefresh}
                className={`p-2 rounded-lg ${
                  isDarkColorScheme ? "bg-gray-700" : "bg-white"
                }`}
              >
                <Icon
                  as={RefreshCw}
                  className={`size-5 ${
                    isDarkColorScheme ? "text-white" : "text-black"
                  }`}
                />
              </TouchableOpacity>
            </View>

            <MonthYearPicker
              selectedDate={pickerDate}
              onDateChange={handleDateChange}
              isDarkColorScheme={isDarkColorScheme}
              minimumDate={new Date(2020, 0, 1)}
              maximumDate={new Date()}
            />
          </View>
        )}

        {/* Legend */}
        <View
          className={`p-4 rounded-lg mb-6 ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}
        >
          <Text
            className={`font-semibold mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
          >
            Keterangan:
          </Text>
          <View className="flex-row flex-wrap">
            <View
              key="legend-present"
              className="flex-row items-center mr-4 mb-2"
            >
              <View
                className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-green-900" : "bg-green-100"}`}
              />
              <Text
                className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
              >
                Hadir
              </Text>
            </View>
            <View
              key="legend-leave"
              className="flex-row items-center mr-4 mb-2"
            >
              <View
                className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-blue-900" : "bg-blue-100"}`}
              />
              <Text
                className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
              >
                Izin
              </Text>
            </View>
            <View key="legend-sick" className="flex-row items-center mr-4 mb-2">
              <View
                className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-yellow-900" : "bg-yellow-100"}`}
              />
              <Text
                className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
              >
                Sakit
              </Text>
            </View>
            <View
              key="legend-absent"
              className="flex-row items-center mr-4 mb-2"
            >
              <View
                className={`w-4 h-4 rounded mr-2 ${isDarkColorScheme ? "bg-red-900" : "bg-red-100"}`}
              />
              <Text
                className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
              >
                Tidak Hadir
              </Text>
            </View>
            <View key="legend-today" className="flex-row items-center mb-2">
              <View
                className={`w-4 h-4 rounded mr-2 border-2 relative ${isDarkColorScheme ? "border-pink-400 bg-gray-700" : "border-pink-500 bg-white"}`}
              >
                <View
                  className={`absolute top-0 right-0 w-1.5 h-1.5 rounded-full ${isDarkColorScheme ? "bg-pink-400" : "bg-pink-500"}`}
                />
              </View>
              <Text
                className={`text-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
              >
                Hari Ini
              </Text>
            </View>
          </View>
        </View>

        {/* Calendar */}
        <View
          className={`rounded-lg p-4 ${isDarkColorScheme ? "bg-gray-800" : "bg-white"}`}
        >
          {/* Day names header */}
          <View className="flex-row mb-2">
            {dayNames.map((dayName) => (
              <View key={dayName} className="flex-1 items-center py-2">
                <Text
                  className={`font-medium ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                >
                  {dayName}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar days */}
          {monthlyAttendance.loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#0284c7" />
              <Text
                className={`mt-2 ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
              >
                Memuat data kehadiran...
              </Text>
            </View>
          ) : (
            <View key={`calendar-${displayYear}-${displayMonth}`}>
              {Array.from(
                { length: Math.ceil((calendarDays?.length || 0) / 7) },
                (_, weekIndex) => (
                  <View
                    key={`week-${displayYear}-${displayMonth}-${weekIndex}`}
                    className="flex-row"
                  >
                    {(calendarDays || [])
                      .slice(weekIndex * 7, weekIndex * 7 + 7)
                      .map((day, dayIndex) => (
                        <CalendarDayComponent
                          key={`${displayYear}-${displayMonth}-w${weekIndex}-d${dayIndex}-${day?.fullDate || "empty"}`}
                          day={day}
                          isDarkColorScheme={isDarkColorScheme}
                          onPress={() => handleDayPress(day)}
                          isSelected={selectedDay?.fullDate === day?.fullDate}
                        />
                      ))}
                  </View>
                ),
              )}
            </View>
          )}
        </View>

        {/* Detail Card - shows when a day is tapped */}
        {detailDay && (
          <DetailCard
            key={`detail-${detailDay.fullDate}-${displayYear}-${displayMonth}`}
            day={detailDay}
            isDarkColorScheme={isDarkColorScheme}
            onClose={() => setDetailDay(null)}
          />
        )}
      </ScrollView>
    );
  },
);

AttendanceCalendar.displayName = "AttendanceCalendar";

export default AttendanceCalendar;
export { formatTime } from "./utils";
