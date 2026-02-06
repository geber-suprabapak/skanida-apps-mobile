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
import { useOptimizedMonthlyAttendance } from "~/components/ui/attendance-calendar/hooks";
import { getMonthDays } from "~/components/ui/attendance-calendar/utils";
import {
  AttendanceCalendarProps,
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar/types";
import { RefreshCw } from "lucide-react-native";
import { Icon } from "~/components/ui/icon";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const AttendanceCalendar = forwardRef<
  AttendanceCalendarRef,
  AttendanceCalendarProps
>(
  (
    { isDarkColorScheme, currentYear: propYear, currentMonth: propMonth },
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
    const calendarDays = useMemo(() => {
      const days = getMonthDays(displayYear, displayMonth);
      return days.map((day) => ({
        ...day,
        attendance: monthlyAttendance.data?.[day.fullDate],
      }));
    }, [displayYear, displayMonth, monthlyAttendance.data]);
    useEffect(() => {
      if (user?.id && typeof monthlyAttendance.refetch === "function") {
        monthlyAttendance.refetch(false);
        const prefetchTimer = setTimeout(() => {
          if (typeof monthlyAttendance.prefetchAdjacent === "function") {
            monthlyAttendance.prefetchAdjacent();
          }
        }, 1000);

        return () => clearTimeout(prefetchTimer);
      }
    }, [displayYear, displayMonth, user?.id, monthlyAttendance]);
    const handleRefresh = useCallback(() => {
      if (user?.id && typeof monthlyAttendance.refetch === "function") {
        monthlyAttendance.refetch(true);
      }
    }, [user?.id, monthlyAttendance]);
    const handleDateChange = useCallback((date: Date) => {
      setPickerDate(date);
    }, []);

    return (
      <ScrollView className="flex-1 px-4">
        {isUsingPicker && (
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

        <View
          className={`rounded-3xl p-5 border border-border shadow-sm ${
            isDarkColorScheme ? "bg-card" : "bg-white"
          }`}
        >
          <View className="flex-row mb-4">
            {DAY_NAMES.map((dayName) => (
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
                        />
                      ))}
                  </View>
                ),
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  },
);

AttendanceCalendar.displayName = "AttendanceCalendar";

export default AttendanceCalendar;
export { formatTime } from "./utils";
