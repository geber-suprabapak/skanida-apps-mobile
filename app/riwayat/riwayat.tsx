import { AntDesign, Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import { View, ScrollView, ActivityIndicator, Alert } from "react-native";

import { Button } from "~/components/ui/button"; // Use the new button
import { Text } from "~/components/ui/text"; // Import Text component
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
          removeClippedSubviews
        >
          {/* Tombol Kembali ke Dashboard */}
          <Button
            variant="outline"
            size="default"
            className={`mx-5 mt-4 mb-2 ${isDarkMode ? "border-primary bg-gray-800" : ""}`}
            onPress={() => router.push("/Dashboard")}
          >
            <View className="flex-row items-center justify-center space-x-2">
              {/* Icon Ionicons dibungkus View */}
              <Ionicons
                name="arrow-back-outline"
                size={20}
                color={isDarkMode ? "#fff" : "hsl(var(--primary))"}
                className="mr-2"
              />
              {/* Text "Kembali ke Dashboard" dibungkus Text component */}
              <Text className={isDarkMode ? "text-white" : "text-black"}>
                Kembali ke Dashboard
              </Text>
            </View>
          </Button>

          {/* Tombol Refresh Data - INI YANG SUDAH DIPERBAIKI */}
          <Button
            variant="default"
            size="sm"
            className="mx-5 my-1"
            onPress={fetchAttendanceHistory}
          >
            {/* Text "Refresh Data" DIBUNGKUS Text component */}
            <Text>Refresh Data</Text>
            {/* Spasi literal dihapus di sini */}
          </Button>

          {/* Bagian Tampilan Data Riwayat atau Loading/Kosong */}
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
                  className={`rounded-xl p-4 mb-4 shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
                >
                  {/* Detail Riwayat */}
                  <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-border">
                    {/* Tanggal dibungkus Text component */}
                    <Text
                      className={`text-base font-bold ${isDarkMode ? "text-white" : "text-card-foreground"}`}
                    >
                      {record.date}
                    </Text>
                    {/* Waktu dibungkus Text component */}
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-muted-foreground"}`}
                    >
                      {new Date(record.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  <View className="flex-row items-center mt-2">
                    {/* Icon AntDesign */}
                    <AntDesign
                      name="checkcircle"
                      size={20}
                      color={isDarkMode ? "#28a745" : "#28a745"} // Warna hijau
                    />
                    {/* Reason dibungkus Text component */}
                    <Text
                      className={`text-sm ml-2 ${isDarkMode ? "text-gray-400" : "text-green-600"}`}
                    >
                      {record.reason}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            // Tampilan jika data kosong
            <View className="flex-1 items-center justify-center p-10 mt-10">
              {/* Icon Ionicons */}
              <Ionicons
                name="document-text-outline"
                size={60}
                color={isDarkMode ? "#4b5563" : "hsl(var(--muted))"}
              />
              {/* Text "Belum Ada Data Kehadiran" dibungkus Text component */}
              <Text
                className={`text-lg font-bold mt-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
              >
                Belum Ada Data Kehadiran
              </Text>
              {/* Text penjelasan dibungkus Text component */}
              <Text
                className={`text-sm mt-2 text-center ${isDarkMode ? "text-gray-400" : "text-muted-foreground/70"}`}
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
