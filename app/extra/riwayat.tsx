import React, { useEffect, useState, useRef } from "react";
import { View, TouchableOpacity, BackHandler, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";

import { Text } from "~/components/ui/text";
import AttendanceCalendar, {
  AttendanceCalendarRef,
} from "~/components/ui/attendance-calendar";
import MonthYearPicker from "~/components/ui/month-year-picker";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Calendar } from "~/lib/icons/Calendar";
import { Settings } from "~/lib/icons/Settings";
import { History } from "~/lib/icons/History";
import { RefreshCw } from "~/lib/icons/RefreshCw";
import { attendanceCache } from "~/utils/attendanceCache";
import useAuthStore from "~/store/authStore";

export default function Riwayat() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isFocused = useIsFocused();

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
    } catch (error) {
      Alert.alert("Error", "Failed to get cache statistics");
    }
  };

  const clearCache = async () => {
    try {
      if (user?.id) {
        await attendanceCache.invalidateUser(user.id);
        Alert.alert("✅ Success", "Cache cleared successfully");
        // Force refresh the calendar after clearing cache
        window.location?.reload?.(); // For web
      }
    } catch (error) {
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

  return (
    <SafeAreaView className={`flex-1 `}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View className={`flex-row items-center p-4 border-b $`}>
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
          className="mr-3"
        >
          <ChevronLeft size={24} />
        </TouchableOpacity>

        <Text className={`text-lg font-bold flex-1 `}>Riwayat Kehadiran</Text>

        {/* Cache management button (only in development) */}
        {__DEV__ && (
          <TouchableOpacity onPress={showCacheInfo} className="ml-3">
            <Settings size={20} />
          </TouchableOpacity>
        )}

        {/* Force refresh button with loading state */}
        <TouchableOpacity
          onPress={forceRefresh}
          className={`ml-3 ${isRefreshing ? "opacity-50" : ""}`}
          disabled={isRefreshing}
        >
          <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
        </TouchableOpacity>
      </View>

      {/* Month/Year Selector */}
      <View className={`p-4 border-b `}>
        <MonthYearPicker
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date()}
        />
      </View>

      {/* Calendar Component */}
      <AttendanceCalendar
        ref={calendarRef}
        currentYear={selectedDate.getFullYear()}
        currentMonth={selectedDate.getMonth()}
        key={`calendar-${selectedDate.getFullYear()}-${selectedDate.getMonth()}`}
      />
    </SafeAreaView>
  );
}
