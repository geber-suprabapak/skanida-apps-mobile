// app/Dashboard.tsx
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require("@react-native-community/netinfo").default;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (error) {
  // Provide a fallback implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  NetInfo = {
    addEventListener: () => ({ remove: () => {} }),
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
  };
}

type AttendanceRecord = {
  id: string;
  date: string;
  created_at: string;
  reason: string;
  photo_url: string;
};

type Message = {
  id: string;
  title: string;
  content: string;
  date: string;
  read: boolean;
};

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAttendanceHistory();
    fetchMessages();
  }, []);

  const fetchAttendanceHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(10);

      if (error) throw error;
      setAttendanceHistory(data || []);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    setMessages([
      {
        id: "1",
        title: "Pemberitahuan Kehadiran",
        content:
          "Rekap absensi bulan ini telah selesai. Silakan periksa riwayat kehadiran Anda.",
        date: "2025-04-12",
        read: false,
      },
      {
        id: "2",
        title: "Pengumuman Penting",
        content:
          "Jadwal absensi diubah menjadi 07.30 - 16.30 mulai minggu depan.",
        date: "2025-04-10",
        read: true,
      },
    ]);
  };

  const markMessageAsRead = (id: string) => {
    setMessages(
      messages.map((msg) => (msg.id === id ? { ...msg, read: true } : msg)),
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: "Dashboard",
          headerStyle: {
            backgroundColor: "hsl(var(--primary))",
          },
          headerTintColor: "hsl(var(--primary-foreground))",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <View
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-brand-background"} relative`}
      >
        <ScrollView
          className={`flex-1 pb-32 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
        >
          {/* User greeting and info */}
          <View
            className={`flex-row items-center p-4 mb-2 rounded-xl mx-5 mt-4 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
          >
            <View className="w-14 h-14 mr-4 flex items-center justify-center rounded-full bg-primary">
              <Text className="text-primary-foreground font-bold text-2xl">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
            <View className="flex-1">
              <Text
                className={`text-sm ${
                  isDarkMode ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                Selamat datang,
              </Text>
              <Text
                className={`font-bold text-lg ${
                  isDarkMode ? "text-white" : "text-card-foreground"
                }`}
              >
                {user?.email || "Pengguna"}
              </Text>
            </View>
          </View>

          {/* Quick actions */}
          <View className="flex-row justify-between px-5 mb-5 space-x-3">
            <Button
              variant="default"
              size="default"
              className="flex-1"
              onPress={() => router.push("/attendance/AbsenceReport")}
            >
              <View className="flex-row items-center justify-center space-x-2">
                {/* Ubah warna ikon berdasarkan mode */}
                <AntDesign
                  name="scan1"
                  size={20}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text className={isDarkMode ? "text-white" : "text-black"}>
                  Absen
                </Text>
              </View>
            </Button>
            <Button
              variant="default"
              size="default"
              className="flex-1"
              onPress={() => router.push("/riwayat/riwayat")}
            >
              <View className="flex-row items-center justify-center space-x-2">
                {/* Ubah warna ikon berdasarkan mode */}
                <MaterialIcons
                  name="history"
                  size={20}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text className={isDarkMode ? "text-white" : "text-black"}>
                  Riwayat
                </Text>
              </View>
            </Button>
            <Button
              variant="default"
              size="default"
              className="flex-1"
              onPress={() => router.push("/pengaturan/pengaturan")}
            >
              <View className="flex-row items-center justify-center space-x-2">
                {/* Ubah warna ikon berdasarkan mode */}
                <Ionicons
                  name="settings-outline"
                  size={20}
                  color={isDarkMode ? "#fff" : "#000"}
                />
                <Text className={isDarkMode ? "text-white" : "text-black"}>
                  Pengaturan
                </Text>
              </View>
            </Button>
          </View>

          {/* Recent attendance */}
          <View
            className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-white"}`}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-gray-900"}`}
            >
              Kehadiran Terbaru
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color="#0066FF" />
            ) : attendanceHistory.length > 0 ? (
              attendanceHistory.slice(0, 3).map((record) => (
                <View
                  key={record.id}
                  className={`flex-row items-center py-3 border-b ${isDarkMode ? "border-gray-700" : "border-brand-gray-lighter"} last:border-b-0`}
                >
                  <View className="mr-3">
                    <AntDesign name="checkcircle" size={24} color="#28a745" />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-medium text-base ${isDarkMode ? "text-white" : "text-gray-900"}`}
                    >
                      {record.date}
                    </Text>
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-400" : "text-brand-gray"}`}
                    >
                      {record.reason}
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${isDarkMode ? "text-gray-400" : "text-brand-gray"}`}
                  >
                    {new Date(record.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              ))
            ) : (
              <Text
                className={`text-center py-4 ${isDarkMode ? "text-white" : "text-brand-gray"}`}
              >
                Belum ada riwayat kehadiran
              </Text>
            )}
            {attendanceHistory.length > 3 && (
              <TouchableOpacity
                className={`w-full items-center mt-3 pt-3 border-t ${isDarkMode ? "border-gray-700" : "border-brand-gray-lighter"}`}
                onPress={() => router.push("/riwayat/riwayat")}
              >
                <Text
                  className={`font-medium ${isDarkMode ? "text-white" : "text-gray-700"}`}
                >
                  Lihat Semua
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Messages */}
          <View
            className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              Pesan Penting
            </Text>
            {messages.length > 0 ? (
              messages.map((message) => (
                <TouchableOpacity
                  key={message.id}
                  className={`flex-row items-center py-3 border-b border-border last:border-b-0 relative ${!message.read ? "bg-accent/20" : ""}`}
                  onPress={() => markMessageAsRead(message.id)}
                >
                  <View className="mr-3">
                    <Ionicons
                      name={
                        message.read
                          ? "mail-open-outline"
                          : "mail-unread-outline"
                      }
                      size={24}
                      color={isDarkMode ? "white" : "black"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-medium text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
                    >
                      {message.title}
                    </Text>
                    <Text
                      className={`text-sm ${isDarkMode ? "text-gray-300" : "text-muted-foreground"}`}
                      numberOfLines={2}
                    >
                      {message.content}
                    </Text>
                    <Text
                      className={`text-xs mt-1 ${isDarkMode ? "text-gray-400" : "text-muted-foreground/70"}`}
                    >
                      {message.date}
                    </Text>
                  </View>
                  {!message.read && (
                    <View className="w-2.5 h-2.5 rounded-full bg-primary absolute top-3 right-0" />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text
                className={`text-center py-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
              >
                Tidak ada pesan baru
              </Text>
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}
