// app/riwayat/riwayat.tsx
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";

import { Button } from "~/components/ui/button"; // Use the new button
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

type AttendanceRecord = {
  id: string;
  date: string;
  created_at: string;
  reason: string;
};

export default function Riwayat() {
  const user = useAuthStore((state) => state.user);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceHistory();
  }, []);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      console.log("Fetching attendance for user ID:", user.id);

      const { data, error } = await supabase
        .from("absences")
        .select("id, date, created_at, reason") // Select only necessary fields
        .eq("user_id", user.id)
        .order("date", { ascending: false });

      if (error) {
        console.error("Supabase query error:", error);
        throw error;
      }

      console.log("Fetched records count:", data?.length || 0);
      if (data && data.length > 0) {
        setAttendanceHistory(data);
      } else {
        setAttendanceHistory([]);
      }
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      Alert.alert(
        "Error",
        "Failed to load attendance history. Please try again later.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Riwayat Kehadiran",
          headerStyle: {
            backgroundColor: isDarkMode
              ? "hsl(var(--primary))"
              : "hsl(var(--primary))",
          },
          headerTintColor: isDarkMode
            ? "hsl(var(--primary-foreground))"
            : "hsl(var(--primary-foreground))",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <View
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
      >
        <ScrollView
          className={`flex-1 pb-32 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
          removeClippedSubviews // For performance
        >
          <Button
            variant="outline" // Keep outline variant
            size="default" // Map medium to default
            className={`mx-5 mt-4 mb-2 ${isDarkMode ? "border-primary bg-gray-800" : ""}`} // Keep className for now
            onPress={() => router.push("/Dashboard")}
          >
            <Ionicons
              name="arrow-back-outline"
              size={20} // Adjust size if needed
              color={isDarkMode ? "#fff" : "hsl(var(--primary))"} // Adjust color based on context
              className="mr-2" // Add margin if needed
            />
            <Text>Kembali ke Dashboard</Text> {/* Wrap text */}
          </Button>

          <Button
            variant="default" // Map primary to default
            size="sm" // Map small to sm
            className="mx-5 my-1"
            onPress={fetchAttendanceHistory}
          >
            <Text>Refresh Data</Text> {/* Wrap text */}
          </Button>

          {loading && attendanceHistory.length === 0 ? (
            <ActivityIndicator
              size="large"
              color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
              className="mt-10"
            />
          ) : attendanceHistory.length > 0 ? (
            <View className="px-5 py-4">
              {attendanceHistory.map((record) => (
                <View
                  key={record.id}
                  className={`rounded-xl p-4 mb-4 shadow-sm ${
                    isDarkMode ? "bg-gray-800" : "bg-card"
                  }`}
                >
                  <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-border">
                    <Text
                      className={`text-base font-bold ${
                        isDarkMode ? "text-white" : "text-card-foreground"
                      }`}
                    >
                      {record.date}
                    </Text>
                    <Text
                      className={`text-sm ${
                        isDarkMode ? "text-gray-400" : "text-muted-foreground"
                      }`}
                    >
                      {new Date(record.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-2">
                    <AntDesign
                      name="checkcircle"
                      size={20}
                      color={isDarkMode ? "#28a745" : "#28a745"}
                    />
                    <Text
                      className={`text-sm ml-2 ${
                        isDarkMode ? "text-gray-400" : "text-green-600"
                      }`}
                    >
                      {record.reason}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center p-10 mt-10">
              <Ionicons
                name="document-text-outline"
                size={60}
                color={isDarkMode ? "#4b5563" : "hsl(var(--muted))"}
              />
              <Text
                className={`text-lg font-bold mt-4 ${
                  isDarkMode ? "text-white" : "text-muted-foreground"
                }`}
              >
                Belum Ada Data Kehadiran
              </Text>
              <Text
                className={`text-sm mt-2 text-center ${
                  isDarkMode ? "text-gray-400" : "text-muted-foreground/70"
                }`}
              >
                Riwayat kehadiran Anda akan muncul di sini
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}
