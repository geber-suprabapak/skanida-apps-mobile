/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from "react";
import {
  View,
  TouchableOpacity,
  BackHandler,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import { Text } from "~/components/ui/text";
import AttendanceCalendar from "~/components/ui/attendance-calendar";
import { useColorScheme } from "~/lib/useColorScheme";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Calendar } from "~/lib/icons/Calendar";
import { Settings } from "~/lib/icons/Settings";
import { ChevronRight } from "~/lib/icons/ChevronRight";
import { attendanceCache } from "~/utils/attendanceCache";
import useAuthStore from "~/store/authStore";

export default function Riwayat() {
  const { isDarkColorScheme } = useColorScheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [showCacheStats, setShowCacheStats] = useState(false);
  
  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  // Date picker handlers
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false); // Always close on both platforms
    
    if (event.type === 'set' && date) {
      // Set to the first day of the selected month to focus on month/year
      const adjustedDate = new Date(date.getFullYear(), date.getMonth(), 1);
      setSelectedDate(adjustedDate);
    }
  };

  const showDatePickerModal = () => {
    setShowDatePicker(true);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric'
    });
  };

  const formatShortMonthYear = (date: Date) => {
    return date.toLocaleDateString('id-ID', {
      month: 'short',
      year: 'numeric'
    });
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
        <Calendar
          size={24}
          color={isDarkColorScheme ? "#ffffff" : "#000000"}
          className="mr-3"
        />
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
        <Text
          className={`text-sm font-medium mb-2 ${
            isDarkColorScheme ? "text-gray-300" : "text-gray-600"
          }`}
        >
          Pilih Bulan & Tahun
        </Text>
        <TouchableOpacity
          onPress={showDatePickerModal}
          className={`flex-row items-center justify-between px-4 py-3 rounded-lg border shadow-sm ${
            isDarkColorScheme 
              ? "bg-gray-700 border-gray-600 shadow-gray-900/20" 
              : "bg-white border-gray-300 shadow-gray-500/10"
          }`}
          style={{
            elevation: 2, // Android shadow
          }}
        >
          <View className="flex-row items-center">
            <Calendar
              size={20}
              color={isDarkColorScheme ? "#ffffff" : "#374151"}
              className="mr-3"
            />
            <Text
              className={`text-lg font-medium ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              {formatMonthYear(selectedDate)}
            </Text>
          </View>
          <ChevronRight
            size={20}
            color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
          />
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(2020, 0, 1)}
        />
      )}

      {/* Calendar Component */}
      <AttendanceCalendar 
        isDarkColorScheme={isDarkColorScheme}
        currentYear={selectedDate.getFullYear()}
        currentMonth={selectedDate.getMonth()}
      />
    </SafeAreaView>
  );
}
