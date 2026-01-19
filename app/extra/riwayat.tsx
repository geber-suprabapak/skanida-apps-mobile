import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  BackHandler,
  Alert,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";

import { Text } from "~/components/ui/text";
import AttendanceCalendar, {
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar";
import MonthYearPicker from "~/components/ui/month-year-picker";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  Settings,
  RefreshCw,
  Calendar,
} from "lucide-react-native";
import { attendanceCache } from "~/utils/attendanceCache";
import useAuthStore from "~/store/authStore";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from "react-native-reanimated";

const SpinningIcon = ({ spinning }: { spinning: boolean }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (spinning) {
      // start infinite linear rotation
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      // stop and gently reset to 0
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 150 });
    }
  }, [spinning, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Icon as={RefreshCw} className="size-5 text-white" />
    </Animated.View>
  );
};

export default function Riwayat() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isFocused = useIsFocused();
  const colorScheme = useColorScheme();
  const isDarkColorScheme = colorScheme === "dark";

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const calendarRef = useRef<AttendanceCalendarRef>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh when screen becomes focused
  useEffect(() => {
    if (isFocused && user?.id) {
      const autoRefresh = async () => {
        try {
          // Clear cache for current and selected months for fresh data
          const currentDate = new Date();
          const selectedYear = selectedDate.getFullYear();
          const selectedMonth = selectedDate.getMonth();
          const currentYear = currentDate.getFullYear();
          const currentMonth = currentDate.getMonth();

          // Clear cache for both current and selected months
          await Promise.all([
            attendanceCache.invalidate(user.id, currentYear, currentMonth),
            selectedYear !== currentYear || selectedMonth !== currentMonth
              ? attendanceCache.invalidate(user.id, selectedYear, selectedMonth)
              : Promise.resolve(),
          ]);

          // Trigger calendar refresh
          if (calendarRef.current) {
            await calendarRef.current.refetch(true);
          }

          console.log("📅 Auto-refreshed riwayat data on focus");
        } catch (error) {
          console.error("Error auto-refreshing riwayat:", error);
        }
      };

      // Small delay to ensure screen is fully loaded
      const timeoutId = setTimeout(autoRefresh, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isFocused, user?.id, selectedDate]);

  // Handle back button
  useEffect(() => {
    const onBackPress = () => {
      try {
        if (router.canGoBack()) {
          router.back();
          return true;
        }
        return false;
      } catch (error) {
        console.error("Error in back press handler:", error);
        return false;
      }
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [router]);

  // Cache management functions
  const showCacheInfo = async () => {
    try {
      const stats = await attendanceCache.getCacheStats();
      Alert.alert(
        "📊 Cache Statistics",
        `Total cached items: ${stats.totalItems}\nCache size: ${stats.totalSize}\nOldest: ${stats.oldestEntry || "N/A"}\nNewest: ${stats.newestEntry || "N/A"}`,
        [
          { text: "Clear Cache", style: "destructive", onPress: clearCache },
          { text: "Close", style: "cancel" },
        ],
      );
    } catch {
      Alert.alert("Error", "Failed to get cache statistics");
    }
  };

  const clearCache = async () => {
    try {
      if (user?.id) {
        await attendanceCache.invalidateUser(user.id);
        Alert.alert("✅ Success", "Cache cleared successfully");
        // Force refresh the calendar after clearing cache
        if (calendarRef.current) {
          await calendarRef.current.refetch(true);
        }
      }
    } catch {
      Alert.alert("❌ Error", "Failed to clear cache");
    }
  };

  // Force refresh function for manual data refresh
  const forceRefresh = async () => {
    if (isRefreshing) return; // Prevent double-refresh

    setIsRefreshing(true);
    try {
      if (user?.id) {
        // Clear cache for selected month first for instant feedback
        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth();

        await attendanceCache.invalidate(user.id, selectedYear, selectedMonth);

        // Trigger calendar refetch with force refresh
        if (calendarRef.current) {
          await calendarRef.current.refetch(true);
        }

        console.log("🔄 Manual refresh completed");
      }
    } catch (error) {
      console.error("Error force refreshing:", error);
      Alert.alert("Error", "Failed to refresh data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Optimized date change handler
  const handleDateChange = async (date: Date) => {
    setSelectedDate(date);

    // Pre-clear cache for the new month to ensure fresh data
    if (user?.id) {
      try {
        await attendanceCache.invalidate(
          user.id,
          date.getFullYear(),
          date.getMonth(),
        );
      } catch (error) {
        console.error("Error clearing cache for new date:", error);
      }
    }
  };

  // Get month name for display
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* === PREMIUM HEADER WITH GRADIENT === */}
      <View className="relative overflow-hidden">
        <LinearGradient
          colors={["#3b82f6", "#2563eb", "#1d4ed8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-6 pt-4 pb-8"
        >
          {/* Top Bar */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={() => {
                try {
                  if (router.canGoBack()) {
                    router.back();
                  }
                } catch (error) {
                  console.error("Error navigating back:", error);
                }
              }}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
            >
              <Icon as={ChevronLeft} className="size-5 text-white" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-2">
              {/* Cache management button (only in development) */}
              {__DEV__ && (
                <TouchableOpacity
                  onPress={showCacheInfo}
                  className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
                >
                  <Icon as={Settings} className="size-5 text-white" />
                </TouchableOpacity>
              )}

              {/* Force refresh button */}
              <TouchableOpacity
                onPress={forceRefresh}
                className={`w-10 h-10 rounded-full bg-white/10 items-center justify-center ${isRefreshing ? "opacity-50" : ""}`}
                disabled={isRefreshing}
              >
                <Animated.View
                  style={
                    isRefreshing
                      ? {
                          transform: [{ rotate: "0deg" }],
                        }
                      : undefined
                  }
                >
                  <SpinningIcon spinning={isRefreshing} />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Title Section */}
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center">
              <Icon as={Calendar} className="size-7 text-white" />
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-white/70 text-sm">Lihat & Pantau</Text>
              <Text className="text-white text-2xl font-bold">
                Riwayat Kehadiran
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Curved Bottom Effect */}
        <View className="absolute -bottom-4 left-0 right-0 h-8 bg-background rounded-t-[32px]" />
      </View>

      {/* === MONTH/YEAR PICKER - MODERN CARD === */}
      <View className="px-6 -mt-2 mb-4">
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
