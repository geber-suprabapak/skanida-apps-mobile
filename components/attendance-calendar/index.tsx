import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";

import { Text } from "~/components/ui/text";
import MonthYearPicker from "~/components/ui/month-year-picker";
import useAuthStore from "~/store/authStore";

import { CalendarDayComponent } from "~/components/attendance-calendar/CalendarDay";
import { useOptimizedMonthlyAttendance } from "~/components/attendance-calendar/hooks";
import { getMonthDays } from "~/components/attendance-calendar/utils";
import {
  AttendanceCalendarProps,
  AttendanceCalendarRef,
} from "~/components/attendance-calendar/types";
import { RefreshCw } from "lucide-react-native";
import { Icon } from "~/components/ui/icon";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const AttendanceCalendar = forwardRef<
  AttendanceCalendarRef,
  AttendanceCalendarProps
>(
  (
    {
      isDarkColorScheme,
      currentYear: propYear,
      currentMonth: propMonth,
      onDataLoaded,
    },
    ref,
  ) => {
    const user = useAuthStore((state) => state.user);
    const [pickerDate, setPickerDate] = useState(new Date());
    const isUsingPicker = propYear === undefined && propMonth === undefined;
    const displayYear =
      propYear !== undefined ? propYear : pickerDate.getFullYear();
    const displayMonth =
      propMonth !== undefined ? propMonth : pickerDate.getMonth();
    const monthlyAttendance = useOptimizedMonthlyAttendance(
      user?.id || "",
      displayYear,
      displayMonth,
    );
    // PERF-C05: Extract stable refetch reference to avoid useEffect firing every render
    const refetch = monthlyAttendance.refetch;
    useImperativeHandle(
      ref,
      () => ({
        refetch: (forceRefresh: boolean = false) => {
          if (user?.id) {
            return refetch(forceRefresh);
          }
          return Promise.resolve();
        },
      }),
      [user?.id, refetch],
    );
    const calendarDays = useMemo(() => {
      const days = getMonthDays(displayYear, displayMonth);
      return days.map((day) => ({
        ...day,
        attendance: monthlyAttendance.data?.[day.fullDate],
      }));
    }, [displayYear, displayMonth, monthlyAttendance.data]);
    // PERF-C05: Use stable refetch reference, remove monthlyAttendance from deps
    useEffect(() => {
      if (user?.id) {
        refetch(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayYear, displayMonth, user?.id]);
    const handleRefresh = useCallback(() => {
      if (user?.id) {
        refetch(true);
      }
    }, [user?.id, refetch]);
    const handleDateChange = useCallback((date: Date) => {
      setPickerDate(date);
    }, []);
    // PERF-H06: Notify parent when attendance data is loaded
    useEffect(() => {
      if (onDataLoaded && monthlyAttendance.data) {
        onDataLoaded(monthlyAttendance.data);
      }
    }, [monthlyAttendance.data, onDataLoaded]);
    // PERF-M10: Memoize maximumDate to avoid new Date() on every render
    const maximumDate = useMemo(() => new Date(), []);

    return (
      <View className="w-full">
        {isUsingPicker && (
          <View className="mb-4 bg-muted rounded-lg p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-foreground">
                Pilih Periode
              </Text>
              <TouchableOpacity
                onPress={handleRefresh}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                className="p-2 rounded-lg bg-card min-h-12 min-w-12 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Perbarui kalender kehadiran"
              >
                <Icon as={RefreshCw} className="size-5 text-foreground" />
              </TouchableOpacity>
            </View>

            <MonthYearPicker
              selectedDate={pickerDate}
              onDateChange={handleDateChange}
              isDarkColorScheme={isDarkColorScheme}
              minimumDate={new Date(2020, 0, 1)}
              maximumDate={maximumDate}
            />
          </View>
        )}

        <View className="rounded-3xl p-5 border border-border shadow-sm bg-card">
          <View className="flex-row mb-4">
            {DAY_NAMES.map((dayName) => (
              <View key={dayName} className="flex-1 items-center">
                <Text
                  className={`text-xs font-bold uppercase tracking-wider ${
                    dayName === "Min"
                      ? "text-rose-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {dayName}
                </Text>
              </View>
            ))}
          </View>

          {monthlyAttendance.loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text className="mt-4 text-sm font-medium text-muted-foreground">
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
                        />
                      ))}
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      </View>
    );
  },
);

AttendanceCalendar.displayName = "AttendanceCalendar";

export default AttendanceCalendar;
export { formatTime } from "./utils";
