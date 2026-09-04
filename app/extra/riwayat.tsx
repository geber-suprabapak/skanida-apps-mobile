import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { View, TouchableOpacity, BackHandler, FlatList } from "react-native";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import { Stack, useRouter, useFocusEffect } from "expo-router";

import { Text } from "~/components/ui/text";
import { StatusBar } from "expo-status-bar";
import AttendanceCalendar, {
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar";
import MonthYearPicker from "~/components/ui/month-year-picker";
import { Icon } from "~/components/ui/icon";
import { Badge } from "~/components/ui/badge";
import { ChevronLeft, Calendar } from "lucide-react-native";

import useAuthStore from "~/store/authStore";
import {
  AttendanceMap,
  AttendanceRecord,
} from "~/components/attendance-calendar/types";
import { formatTime } from "~/components/attendance-calendar/utils";
import { formatDateWIB } from "~/lib/utils";
import { useUniwind } from "uniwind";

export default function Riwayat() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { theme } = useUniwind();
  const isDarkColorScheme = theme === "dark";

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarRef = useRef<AttendanceCalendarRef>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
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

  // PERF-H06: Derive stats from calendar data instead of separate fetch
  const handleCalendarDataLoaded = useCallback((data: AttendanceMap) => {
    let hadirCount = 0;
    let terlambatCount = 0;
    let sakitCount = 0;
    let izinCount = 0;

    // Group by date for deduplication
    const byDate: Record<string, (typeof data)[string][]> = {};
    Object.values(data).forEach((record) => {
      if (!byDate[record.date]) byDate[record.date] = [];
      byDate[record.date].push(record);
    });

    Object.values(byDate).forEach((records) => {
      const firstRecord = records[0];
      if (firstRecord.status === "sick") {
        sakitCount++;
      } else if (firstRecord.status === "leave") {
        izinCount++;
      } else if (firstRecord.isLate || firstRecord.status === "late") {
        terlambatCount++;
      } else if (firstRecord.status === "present") {
        hadirCount++;
      }
    });

    setMonthlyStats({
      hadir: hadirCount,
      terlambat: terlambatCount,
      sakit: sakitCount,
      izin: izinCount,
    });

    const sorted = Object.values(data).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    setRecords(sorted);
  }, []);

  // PERF-M10: Memoize maximumDate to avoid new Date() on every render
  const maximumDate = useMemo(() => new Date(), []);

  const handleDateChange = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: 92,
      offset: 92 * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(({ item }: { item: AttendanceRecord }) => {
    const isLate = item.isLate || item.status === "late";
    const badgeVariant: "hadir" | "terlambat" | "izin" | "sakit" =
      item.status === "sick"
        ? "sakit"
        : item.status === "leave"
          ? "izin"
          : isLate
            ? "terlambat"
            : "hadir";

    const badgeLabel =
      badgeVariant === "hadir"
        ? "Hadir"
        : badgeVariant === "terlambat"
          ? "Terlambat"
          : badgeVariant === "sakit"
            ? "Sakit"
            : "Izin";

    return (
      <View className="h-20 justify-center px-4 mb-3 bg-card rounded-2xl border border-border">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Text className="text-foreground font-bold text-base">
              {formatDateWIB(new Date(item.date))}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              {item.checkInTime
                ? `Masuk: ${formatTime(item.checkInTime)}${
                    item.checkOutTime
                      ? ` • Pulang: ${formatTime(item.checkOutTime)}`
                      : ""
                  }`
                : item.description || "Pengajuan izin tercatat"}
            </Text>
          </View>
          <Badge variant={badgeVariant}>
            <Text>{badgeLabel}</Text>
          </Badge>
        </View>
      </View>
    );
  }, []);

  const ListHeader = useMemo(
    () => (
      <View>
        {/* === MONTH/YEAR PICKER - MODERN CARD === */}
        <View className="mt-6 mb-4">
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
              maximumDate={maximumDate}
              isDarkColorScheme={isDarkColorScheme}
            />
          </View>
        </View>

        {/* === MONTHLY STATISTICS CARDS === */}
        <View className="mb-4">
          <View className="flex-row flex-wrap gap-3">
            {/* Hadir Card */}
            <View className="flex-1 min-w-[45%] bg-card rounded-2xl p-4 border border-border">
              <Text className="text-foreground text-4xl font-bold mb-3">
                {monthlyStats.hadir}
              </Text>
              <Badge variant="hadir">
                <Text>Hadir</Text>
              </Badge>
            </View>

            {/* Terlambat Card */}
            <View className="flex-1 min-w-[45%] bg-card rounded-2xl p-4 border border-border">
              <Text className="text-foreground text-4xl font-bold mb-3">
                {monthlyStats.terlambat}
              </Text>
              <Badge variant="terlambat">
                <Text>Terlambat</Text>
              </Badge>
            </View>

            {/* Sakit Card */}
            <View className="flex-1 min-w-[45%] bg-card rounded-2xl p-4 border border-border">
              <Text className="text-foreground text-4xl font-bold mb-3">
                {monthlyStats.sakit}
              </Text>
              <Badge variant="sakit">
                <Text>Sakit</Text>
              </Badge>
            </View>

            {/* Izin Card */}
            <View className="flex-1 min-w-[45%] bg-card rounded-2xl p-4 border border-border">
              <Text className="text-foreground text-4xl font-bold mb-3">
                {monthlyStats.izin}
              </Text>
              <Badge variant="izin">
                <Text>Izin</Text>
              </Badge>
            </View>
          </View>
        </View>

        {/* === CALENDAR COMPONENT === */}
        <View className="mb-6">
          <AttendanceCalendar
            ref={calendarRef}
            currentYear={selectedDate.getFullYear()}
            currentMonth={selectedDate.getMonth()}
            isDarkColorScheme={isDarkColorScheme}
            onDataLoaded={handleCalendarDataLoaded}
          />
        </View>

        {/* Section title */}
        {records.length > 0 && (
          <Text className="text-xs uppercase tracking-widest font-medium text-muted-foreground mb-3 ml-1">
            Rincian Kehadiran
          </Text>
        )}
      </View>
    ),
    [
      selectedDate,
      handleDateChange,
      maximumDate,
      isDarkColorScheme,
      monthlyStats,
      handleCalendarDataLoaded,
      records.length,
    ],
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <StatusBar style={isDarkColorScheme ? "light" : "dark"} />

      {/* Simple Header */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-border">
        <TouchableOpacity
          onPress={() => router.canGoBack() && router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          accessibilityHint="Ketuk dua kali untuk kembali ke beranda"
          className="w-12 h-12 rounded-full bg-secondary items-center justify-center border border-border"
        >
          <Icon as={ChevronLeft} className="size-6 text-secondary-foreground" />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-foreground">
          Riwayat Kehadiran
        </Text>

        <View className="w-10" />
      </View>

      <FlatList
        className="flex-1 px-6"
        data={records}
        keyExtractor={(item) => item.id || item.date}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={6}
        ListHeaderComponent={ListHeader}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40,
          width: "100%",
          maxWidth: 672,
          alignSelf: "center",
        }}
      />
    </SafeAreaView>
  );
}
