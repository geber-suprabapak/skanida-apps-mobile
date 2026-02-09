import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  BackHandler,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { Text } from "~/components/ui/text";
import { StatusBar } from "expo-status-bar";
import AttendanceCalendar, {
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar";
import MonthYearPicker from "~/components/ui/month-year-picker";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Calendar } from "lucide-react-native";

import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";

export default function Riwayat() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const colorScheme = useColorScheme();
  const isDarkColorScheme = colorScheme === "dark";

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarRef = useRef<AttendanceCalendarRef>(null);
  const [monthlyStats, setMonthlyStats] = useState({
    hadir: 0,
    terlambat: 0,
    sakit: 0,
    izin: 0,
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.id && calendarRef.current) {
        calendarRef.current.refetch(true);
      }
    }, [user?.id]),
  );

  // Fetch monthly stats when date changes
  useEffect(() => {
    if (user?.id) {
      fetchMonthlyStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedDate]);

  useEffect(() => {
    const onBackPress = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [router]);

  const fetchMonthlyStats = useCallback(async () => {
    if (!user) return;

    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: absences } = await supabase
        .from("absences")
        .select("status, date")
        .eq("user_id", user.id)
        .gte("date", startDate)
        .lte("date", endDate);

      const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));
      const { data: leaves } = await supabase
        .from("perizinan")
        .select("kategori_izin")
        .eq("user_id", user.id)
        .gte("tanggal", `${startDate}T00:00:00.000Z`)
        .lt("tanggal", nextMonthStart.toISOString());

      let hadirCount = 0;
      let terlambatCount = 0;

      const absencesByDate: Record<string, any[]> = {};
      absences?.forEach((record) => {
        if (!absencesByDate[record.date]) absencesByDate[record.date] = [];
        absencesByDate[record.date].push(record);
      });

      Object.values(absencesByDate).forEach((records) => {
        const hasAlpha = records.some((r) => r.status === "Alpha");
        const hasTerlambat = records.some((r) => r.status === "Terlambat");
        if (!hasAlpha) {
          if (hasTerlambat) terlambatCount++;
          else hadirCount++;
        }
      });

      const sakitCount =
        leaves?.filter((l) => l.kategori_izin === "sakit").length || 0;
      const izinCount =
        leaves?.filter((l) => l.kategori_izin !== "sakit").length || 0;

      setMonthlyStats({
        hadir: hadirCount,
        terlambat: terlambatCount,
        sakit: sakitCount,
        izin: izinCount,
      });
    } catch {}
  }, [user, selectedDate]);

  // Handle date change
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar style={isDarkColorScheme ? "light" : "dark"} />

      {/* Simple Header */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.canGoBack() && router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-100 dark:border-gray-700"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-gray-900 dark:text-gray-100"
          />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Riwayat Kehadiran
        </Text>

        <View className="w-10" />
      </View>

      {/* === MONTH/YEAR PICKER - MODERN CARD === */}
      <View className="px-6 mt-6 mb-4">
        <View className="bg-card rounded-2xl p-4 border border-border shadow-sm">
          <View className="flex-row items-center mb-3">
            <View className="w-8 h-8 rounded-lg bg-violet-500/10 items-center justify-center">
              <Icon as={Calendar} className="size-4 text-violet-500" />
            </View>
            <Text className="text-foreground font-semibold ml-3">
              Pilih Bulan
            </Text>
          </View>
          <MonthYearPicker
            selectedDate={selectedDate}
            onDateChange={handleDateChange}
            minimumDate={new Date(2020, 0, 1)}
            maximumDate={new Date()}
            isDarkColorScheme={isDarkColorScheme}
          />
        </View>
      </View>

      {/* === MONTHLY STATISTICS CARDS === */}
      <View className="px-6 mb-4">
        <View className="flex-row flex-wrap gap-3">
          {/* Hadir Card */}
          <View className="flex-1 min-w-[45%] bg-white dark:bg-card rounded-2xl p-4 border-[3px] border-green-400 dark:border-green-700 shadow-sm">
            <Text className="text-green-600 dark:text-green-400 text-4xl font-bold mb-1">
              {monthlyStats.hadir}
            </Text>
            <Text className="text-green-600 dark:text-green-400 text-sm font-semibold">
              Hadir
            </Text>
          </View>

          {/* Terlambat Card */}
          <View className="flex-1 min-w-[45%] bg-white dark:bg-card rounded-2xl p-4 border-[3px] border-orange-400 dark:border-orange-700 shadow-sm">
            <Text className="text-orange-600 dark:text-orange-400 text-4xl font-bold mb-1">
              {monthlyStats.terlambat}
            </Text>
            <Text className="text-orange-600 dark:text-orange-400 text-sm font-semibold">
              Terlambat
            </Text>
          </View>

          {/* Sakit Card */}
          <View className="flex-1 min-w-[45%] bg-white dark:bg-card rounded-2xl p-4 border-[3px] border-red-400 dark:border-red-700 shadow-sm">
            <Text className="text-red-600 dark:text-red-400 text-4xl font-bold mb-1">
              {monthlyStats.sakit}
            </Text>
            <Text className="text-red-600 dark:text-red-400 text-sm font-semibold">
              Sakit
            </Text>
          </View>

          {/* Izin Card */}
          <View className="flex-1 min-w-[45%] bg-white dark:bg-card rounded-2xl p-4 border-[3px] border-blue-400 dark:border-blue-700 shadow-sm">
            <Text className="text-blue-600 dark:text-blue-400 text-4xl font-bold mb-1">
              {monthlyStats.izin}
            </Text>
            <Text className="text-blue-600 dark:text-blue-400 text-sm font-semibold">
              Izin
            </Text>
          </View>
        </View>
      </View>

      {/* === CALENDAR COMPONENT === */}
      <View className="flex-1 px-2">
        <AttendanceCalendar
          ref={calendarRef}
          currentYear={selectedDate.getFullYear()}
          currentMonth={selectedDate.getMonth()}
          isDarkColorScheme={isDarkColorScheme}
          key={`calendar-${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
        />
      </View>
    </SafeAreaView>
  );
}
