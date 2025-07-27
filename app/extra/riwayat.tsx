/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  BackHandler,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";

import { Text } from "~/components/ui/text";
import AttendanceCalendar from "~/components/ui/attendance-calendar";
import MonthYearPicker from "~/components/ui/month-year-picker";
import { useColorScheme } from "~/lib/useColorScheme";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Calendar } from "~/lib/icons/Calendar";
import { Settings } from "~/lib/icons/Settings";
import { History } from "~/lib/icons/History";
import { attendanceCache } from "~/utils/attendanceCache";
import useAuthStore from "~/store/authStore";

export default function Riwayat() {
  const { isDarkColorScheme } = useColorScheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());

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
        console.error('Error in back press handler:', error);
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
        `Total cached items: ${stats.totalItems}\nCache size: ${stats.totalSize}\nOldest: ${stats.oldestEntry || 'N/A'}\nNewest: ${stats.newestEntry || 'N/A'}`,
        [
          { text: "Clear Cache", style: "destructive", onPress: clearCache },
          { text: "Close", style: "cancel" }
        ]
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
      }
    } catch (error) {
      Alert.alert("❌ Error", "Failed to clear cache");
    }
  };

  // Date change handler for custom picker
  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className={`flex-row items-center p-4 border-b ${
          isDarkColorScheme
            ? "border-gray-700 bg-gray-900"
            : "border-border bg-background"
        }`}
      >
        <TouchableOpacity
          onPress={() => {
            try {
              if (router.canGoBack()) {
                router.back();
              }
            } catch (error) {
              console.error('Error navigating back:', error);
            }
          }}
          className="mr-3"
        >
          <ChevronLeft
            size={24}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
        </TouchableOpacity>
        
        <Text
          className={`text-lg font-bold flex-1 ${
            isDarkColorScheme ? "text-white" : "text-foreground"
          }`}
        >
          Riwayat Kehadiran
        </Text>

        {/* Cache management button (only in development) */}
        {__DEV__ && (
          <TouchableOpacity
            onPress={showCacheInfo}
            className="ml-3"
          >
            <Settings
              size={20}
              color={isDarkColorScheme ? "#ffffff" : "#000000"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Month/Year Selector */}
      <View
        className={`p-4 border-b ${
          isDarkColorScheme
            ? "border-gray-700 bg-gray-800"
            : "border-border bg-background"
        }`}
      >
        <MonthYearPicker
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          isDarkColorScheme={isDarkColorScheme}
          minimumDate={new Date(2020, 0, 1)}
          maximumDate={new Date()}
        />
      </View>

      {/* Calendar Component */}
      <AttendanceCalendar
        isDarkColorScheme={isDarkColorScheme}
        currentYear={selectedDate.getFullYear()}
        currentMonth={selectedDate.getMonth()}
      />
    </SafeAreaView>
  );
}
