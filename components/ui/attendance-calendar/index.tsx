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

    // Calculate monthly stats
    const stats = useMemo(() => {
      const initialStats = {
        present: 0,
        leave: 0,
        sick: 0,
        absent: 0,
      };

      if (!calendarDays.length) return initialStats;

      return calendarDays.reduce((acc, day) => {
        // Only count current month days that are not in the future
        if (!day.isCurrentMonth || day.isFuture) return acc;

        if (day.attendance?.status === "present") acc.present++;
        else if (day.attendance?.status === "leave") acc.leave++;
        else if (day.attendance?.status === "sick") acc.sick++;
        else if (!day.attendance) acc.absent++; // Assuming no record in past = absent/alpha

        return acc;
      }, initialStats);
    }, [calendarDays]);


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

        {/* Summary Stats Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl p-3 items-center">
            <Text className="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase mb-1">
              Hadir
            </Text>
            <Text className="text-emerald-700 dark:text-emerald-300 text-xl font-bold">
              {stats.present}
            </Text>
          </View>
          <View className="flex-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl p-3 items-center">
            <Text className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase mb-1">
              Izin
            </Text>
            <Text className="text-blue-700 dark:text-blue-300 text-xl font-bold">
              {stats.leave}
            </Text>
          </View>
          <View className="flex-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900 rounded-2xl p-3 items-center">
            <Text className="text-rose-600 dark:text-rose-400 text-xs font-bold uppercase mb-1">
              Sakit
            </Text>
            <Text className="text-rose-700 dark:text-rose-300 text-xl font-bold">
              {stats.sick}
            </Text>
          </View>

        </View>

        {/* Calendar Card */}
        <View
          className={`rounded-3xl p-5 border border-border shadow-sm ${
            isDarkColorScheme ? "bg-card" : "bg-white"
          }`}
        >
          {/* Day names header */}
          <View className="flex-row mb-4">
            {dayNames.map((dayName) => (
              <View key={dayName} className="flex-1 items-center">
                <Text
                  className={`text-xs font-bold uppercase tracking-wider ${
                    dayName === "Min"
                      ? "text-rose-500"
                      : isDarkColorScheme
                        ? "text-muted-foreground"
                        : "text-gray-400"
                  }`}
                >
                  {dayName}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar days */}
          {monthlyAttendance.loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text
                className={`mt-4 text-sm font-medium ${
                  isDarkColorScheme ? "text-muted-foreground" : "text-gray-500"
                }`}
              >
                Memuat data...
              </Text>
            </View>
          ) : (
            <View key={`calendar-${displayYear}-${displayMonth}`}>
              {Array.from(
                { length: Math.ceil((calendarDays?.length || 0) / 7) },
                (_, weekIndex) => (
                  <View
                    key={`week-${displayYear}-${displayMonth}-${weekIndex}`}
                    className="flex-row mb-2 last:mb-0"
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

          {/* New Legend Style - Bottom of Card */}
          <View className="flex-row justify-center gap-4 mt-8 pt-4 border-t border-dashed border-border/50">
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-[10px] font-bold text-muted-foreground uppercase">Hadir</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-blue-500" />
              <Text className="text-[10px] font-bold text-muted-foreground uppercase">Izin</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-2 h-2 rounded-full bg-rose-500" />
              <Text className="text-[10px] font-bold text-muted-foreground uppercase">Sakit</Text>
            </View>

          </View>
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
