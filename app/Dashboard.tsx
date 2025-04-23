// app/Dashboard.tsx
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Button } from "~/components/Button";
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
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);

  const [activeTab, setActiveTab] = useState("home");
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

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Apakah Anda yakin ingin keluar?",
      [
        {
          text: "Batal",
          style: "cancel",
        },
        {
          text: "Ya, Keluar",
          style: "destructive",
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              setUser(null);
              router.replace("/auth/AuthSelector");
            } catch (error) {
              console.error("Logout error:", error);
              Alert.alert(
                "Error",
                "Gagal melakukan logout. Silakan coba lagi.",
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const markMessageAsRead = (id: string) => {
    setMessages(
      messages.map((msg) => (msg.id === id ? { ...msg, read: true } : msg)),
    );
  };

  const renderHomeTab = () => (
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
          <Text className="text-sm text-muted-foreground">Selamat datang,</Text>
          <Text className="font-bold text-lg text-card-foreground">
            {user?.email || "Pengguna"}
          </Text>
        </View>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-between px-5 mb-5 space-x-3">
        <Button
          variant="primary"
          size="medium"
          className="flex-1"
          onPress={() => router.push("/attendance/AbsenceReport")}
          leftIcon={<AntDesign name="scan1" size={20} color="#fff" />}
        >
          Absen
        </Button>
        <Button
          variant="primary"
          size="medium"
          className="flex-1"
          onPress={() => router.push("/riwayat/riwayat")}
          leftIcon={<MaterialIcons name="history" size={20} color="#fff" />}
        >
          Riwayat
        </Button>
        <Button
          variant="primary"
          size="medium"
          className="flex-1"
          onPress={() => setActiveTab("settings")}
          leftIcon={<Ionicons name="settings-outline" size={20} color="#fff" />}
        >
          Pengaturan
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
                    message.read ? "mail-open-outline" : "mail-unread-outline"
                  }
                  size={24}
                  color="white"
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
  );

  const renderSettingsTab = () => (
    <ScrollView
      className={`flex-1 pb-32 ${isDarkMode ? "dark:bg-background" : "bg-background"}`}
    >
      <Text
        className={`text-xl font-bold my-4 px-5 ${isDarkMode ? "text-white" : "text-card-foreground"}`}
      >
        Pengaturan
      </Text>
      {/* Profile Section */}
      <View
        className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
      >
        <Text
          className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
        >
          Profil
        </Text>
        <View className="flex-row items-center mb-4 pb-4 border-b border-border">
          <View className="w-16 h-16 rounded-full bg-primary justify-center items-center mr-4">
            <Text className="text-2xl font-bold text-primary-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View className="flex-1">
            <Text
              className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-card-foreground"}`}
            >
              {user?.email || "Pengguna"}
            </Text>
            <Text
              className={`text-sm mt-1 ${isDarkMode ? "text-gray-300" : "text-muted-foreground"}`}
            >
              User ID: {user?.id?.substring(0, 8) || "Unknown"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          className="flex-row items-center py-3 border-b border-border"
          onPress={() => router.push("/profile/EditProfile")}
        >
          <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
            <Ionicons
              name="person-outline"
              size={20}
              color="hsl(var(--accent-foreground))"
            />
          </View>
          <Text
            className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
          >
            Edit Profil
          </Text>
          <AntDesign
            name="right"
            size={16}
            color="hsl(var(--muted-foreground))"
            className="ml-2"
          />
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-row items-center py-3"
          onPress={() => router.push("/profile/ChangePassword")}
        >
          <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
            <Ionicons
              name="key-outline"
              size={20}
              color="hsl(var(--accent-foreground))"
            />
          </View>
          <Text
            className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
          >
            Ubah Password
          </Text>
          <AntDesign
            name="right"
            size={16}
            color="hsl(var(--muted-foreground))"
            className="ml-2"
          />
        </TouchableOpacity>
      </View>
      {/* Preferences Section */}
      <View
        className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
      >
        <Text
          className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
        >
          Preferensi
        </Text>
        <View className="flex-row items-center py-3 border-b border-border">
          <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
            <Ionicons
              name={isDarkMode ? "moon" : "moon-outline"}
              size={20}
              color="hsl(var(--accent-foreground))"
            />
          </View>
          <Text
            className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
          >
            Mode Gelap
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={setDarkMode}
            trackColor={{
              false: "hsl(var(--muted))",
              true: "hsl(var(--primary))",
            }}
            thumbColor={
              isDarkMode ? "hsl(var(--primary-foreground))" : "#f4f3f4"
            }
          />
        </View>
        <TouchableOpacity className="flex-row items-center py-3">
          <View className="w-9 h-9 rounded-lg bg-accent justify-center items-center mr-3">
            <Ionicons
              name="notifications-outline"
              size={20}
              color="hsl(var(--accent-foreground))"
            />
          </View>
          <Text
            className={`flex-1 text-base ${isDarkMode ? "text-white" : "text-card-foreground"}`}
          >
            Notifikasi
          </Text>
          <AntDesign
            name="right"
            size={16}
            color="hsl(var(--muted-foreground))"
            className="ml-2"
          />
        </TouchableOpacity>
      </View>
      {/* Account Section */}
      <View
        className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? "dark:bg-card" : "bg-card"}`}
      >
        <Text
          className={`text-sm font-medium mb-4 ${isDarkMode ? "text-white" : "text-muted-foreground"}`}
        >
          Akun
        </Text>
        <Button
          variant="danger"
          size="medium"
          onPress={handleLogout}
          className="w-full rounded-lg py-3 bg-destructive/10"
          leftIcon={
            <Ionicons
              name="log-out-outline"
              size={24}
              color="hsl(var(--destructive))"
            />
          }
        >
          Keluar
        </Button>
      </View>
    </ScrollView>
  );

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
        {/* Content based on active tab */}
        {activeTab === "home" && (
          <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="flex-1"
          >
            {renderHomeTab()}
          </Animated.View>
        )}
        {activeTab === "settings" && (
          <Animated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(200)}
            className="flex-1"
          >
            {renderSettingsTab()}
          </Animated.View>
        )}

        {/* Bottom Navigation */}
        <View
          className={`flex-row justify-around items-center h-16 border-t shadow-inner ${isDarkMode ? "bg-card border-border" : "bg-card border-border"}`}
        >
          <AnimatedTabButton
            isActive={activeTab === "home"}
            icon={activeTab === "home" ? "home" : "home-outline"}
            label="Beranda"
            onPress={() => setActiveTab("home")}
            isDarkMode={isDarkMode}
          />
          <AnimatedTabButton
            isActive={false}
            icon="calendar-outline"
            label="Kehadiran"
            onPress={() => router.push("/riwayat/riwayat")}
            isDarkMode={isDarkMode}
          />
          <AnimatedTabButton
            isActive={activeTab === "settings"}
            icon={activeTab === "settings" ? "settings" : "settings-outline"}
            label="Pengaturan"
            onPress={() => setActiveTab("settings")}
            isDarkMode={isDarkMode}
          />
        </View>
      </View>
    </>
  );
}

// Animated Tab Button Component
type AnimatedTabButtonProps = {
  isActive: boolean;
  icon: any; // Changed from string to any to accommodate Ionicons name prop types
  label: string;
  onPress: () => void;
  isDarkMode: boolean;
};

function AnimatedTabButton({
  isActive,
  icon,
  label,
  onPress,
  isDarkMode,
}: AnimatedTabButtonProps) {
  // Animation values
  const scale = useSharedValue(1);

  // Define animated styles
  const animatedStyles = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Handle press animation
  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 10, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
  };

  return (
    <Animated.View
      className={`flex-1 justify-center items-center h-full ${
        isActive
          ? `border-t-2 border-primary ${isDarkMode ? "bg-background/30" : "bg-background"}`
          : ""
      }`}
      style={animatedStyles}
    >
      <TouchableOpacity
        className="flex-1 justify-center items-center w-full"
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <Ionicons
          name={icon as any}
          size={24}
          color={
            isActive
              ? "hsl(var(--primary))"
              : isDarkMode
                ? "hsl(var(--muted-foreground))"
                : "hsl(var(--muted-foreground))"
          }
        />
        <Text
          className={`text-xs mt-1 ${
            isActive
              ? "text-primary font-semibold"
              : isDarkMode
                ? "text-muted-foreground"
                : "text-muted-foreground"
          }`}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
