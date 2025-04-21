// app/Dashboard.tsx
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Image,
  Alert,
  Pressable,
  useColorScheme,
} from "react-native";
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInRight, 
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  Layout
} from "react-native-reanimated";

// Import NetInfo with error handling
let NetInfo: any;
try {
  NetInfo = require("@react-native-community/netinfo").default;
} catch (error) {
  // Provide a fallback implementation
  NetInfo = {
    addEventListener: () => ({ remove: () => {} }),
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
  };
}

import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { Button } from "~/components/Button";
import PhotoViewModal from "~/components/PhotoViewModal";

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
  const systemColorScheme = useColorScheme();
  
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const setDarkMode = useThemeStore((state) => state.setDarkMode);
  
  const [activeTab, setActiveTab] = useState("home");
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);

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
        content: "Rekap absensi bulan ini telah selesai. Silakan periksa riwayat kehadiran Anda.",
        date: "2025-04-12",
        read: false,
      },
      {
        id: "2",
        title: "Pengumuman Penting",
        content: "Jadwal absensi diubah menjadi 07.30 - 16.30 mulai minggu depan.",
        date: "2025-04-10",
        read: true,
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Apakah Anda yakin ingin keluar?',
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Ya, Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              setUser(null);
              router.replace("/auth/AuthSelector");
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Gagal melakukan logout. Silakan coba lagi.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const markMessageAsRead = (id: string) => {
    setMessages(
      messages.map((msg) =>
        msg.id === id ? { ...msg, read: true } : msg
      )
    );
  };

  const renderHomeTab = () => (
    <ScrollView className={`flex-1 pb-32 ${isDarkMode ? 'bg-gray-900' : 'bg-brand-background'}`}>
      {/* User greeting and info */}
      <View className={`flex-row items-center p-4 mb-2 rounded-xl mx-5 mt-4 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <View className="w-14 h-14 mr-4 flex items-center justify-center rounded-full bg-brand-purple">
          <Text className="text-white font-bold text-2xl">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>Selamat datang,</Text>
          <Text className={`font-bold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
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
          variant="secondary"
          size="medium"
          className="flex-1"
          onPress={() => setActiveTab("attendance")}
          leftIcon={<MaterialIcons name="history" size={20} color={isDarkMode ? "#fff" : "#212121"} />}
        >
          Riwayat
        </Button>
        <Button
          variant="tertiary"
          size="medium"
          className="flex-1"
          onPress={() => setActiveTab("settings")}
          leftIcon={<Ionicons name="settings-outline" size={20} color={isDarkMode ? "#fff" : "#212121"} />}
        >
          Pengaturan
        </Button>
      </View>

      {/* Recent attendance */}
      <View className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Kehadiran Terbaru
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#E600FF" />
        ) : attendanceHistory.length > 0 ? (
          attendanceHistory.slice(0, 3).map((record) => (
            <View key={record.id} className={`flex-row items-center py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'} last:border-b-0`}>
              <View className="mr-3">
                <AntDesign name="checkcircle" size={24} color="#28a745" />
              </View>
              <View className="flex-1">
                <Text className={`font-medium text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {record.date}
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
                  {record.reason}
                </Text>
              </View>
              <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
                {new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          ))
        ) : (
          <Text className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
            Belum ada riwayat kehadiran
          </Text>
        )}
        {attendanceHistory.length > 3 && (
          <TouchableOpacity
            className={`w-full items-center mt-3 pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'}`}
            onPress={() => setActiveTab("attendance")}
          >
            <Text className="text-brand-purple font-medium">Lihat Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <View className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Pesan Penting
        </Text>
        {messages.length > 0 ? (
          messages.map((message) => (
            <TouchableOpacity
              key={message.id}
              className={`flex-row items-center py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'} last:border-b-0 relative ${!message.read ? isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50' : ''}`}
              onPress={() => markMessageAsRead(message.id)}
            >
              <View className="mr-3">
                <Ionicons
                  name={message.read ? "mail-open-outline" : "mail-unread-outline"}
                  size={24}
                  color={message.read ? (isDarkMode ? "#9ca3af" : "#6c757d") : "#E600FF"}
                />
              </View>
              <View className="flex-1">
                <Text className={`font-medium text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {message.title}
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`} numberOfLines={2}>
                  {message.content}
                </Text>
                <Text className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-brand-gray-light'}`}>
                  {message.date}
                </Text>
              </View>
              {!message.read && <View className="w-2.5 h-2.5 rounded-full bg-brand-purple absolute top-3 right-0" />}
            </TouchableOpacity>
          ))
        ) : (
          <Text className={`text-center py-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
            Tidak ada pesan baru
          </Text>
        )}
      </View>
    </ScrollView>
  );

  const renderAttendanceTab = () => (
    <ScrollView className={`flex-1 pb-32 ${isDarkMode ? 'bg-gray-900' : 'bg-brand-background'}`}>
      <Text className={`text-xl font-bold my-4 px-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Riwayat Kehadiran
      </Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" className="mt-10" />
      ) : attendanceHistory.length > 0 ? (
        <View className="px-5">
          {attendanceHistory.map((record) => (
            <View key={record.id} className={`rounded-xl p-4 mb-4 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <View className={`flex-row justify-between items-center mb-3 pb-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'}`}>
                <Text className={`text-base font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {record.date}
                </Text>
                <Text className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
                  {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center">
                  <AntDesign name="checkcircle" size={20} color="#28a745" />
                  <Text className={`text-sm ml-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>{record.reason}</Text>
                </View>
                {record.photo_url && (
                  <TouchableOpacity 
                    className="p-1 -m-1 rounded-md"
                    onPress={() => { 
                      setSelectedPhoto(record.photo_url);
                      setPhotoModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: record.photo_url }} 
                      className="w-10 h-10 rounded-md bg-gray-200"
                      resizeMode="cover" 
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center p-10 mt-10">
          <Ionicons name="document-text-outline" size={60} color={isDarkMode ? "#555555" : "#d1d1d1"} />
          <Text className={`text-lg font-bold mt-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
            Belum Ada Data Kehadiran
          </Text>
          <Text className={`text-sm mt-2 text-center ${isDarkMode ? 'text-gray-500' : 'text-brand-gray'}`}>
            Riwayat kehadiran Anda akan muncul di sini
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView className={`flex-1 pb-32 ${isDarkMode ? 'bg-gray-900' : 'bg-brand-background'}`}>
      <Text className={`text-xl font-bold my-4 px-5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
        Pengaturan
      </Text>
      {/* Profile Section */}
      <View className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
          Profil
        </Text>
        <View className={`flex-row items-center mb-4 pb-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'}`}>
          <View className="w-16 h-16 rounded-full bg-brand-blue justify-center items-center mr-4">
            <Text className="text-2xl font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {user?.email || "Pengguna"}
            </Text>
            <Text className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
              User ID: {user?.id?.substring(0,8) || "Unknown"}
            </Text>
          </View>
        </View>
        <TouchableOpacity className={`flex-row items-center py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'}`}>
          <View className={`w-9 h-9 rounded-lg ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} justify-center items-center mr-3`}>
            <Ionicons name="person-outline" size={20} color={isDarkMode ? "#60a5fa" : "#007AFF"} />
          </View>
          <Text className={`flex-1 text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Edit Profil
          </Text>
          <AntDesign name="right" size={16} color={isDarkMode ? "#6b7280" : "#c7c7cc"} className="ml-2" />
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center py-3">
          <View className={`w-9 h-9 rounded-lg ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} justify-center items-center mr-3`}>
            <Ionicons name="key-outline" size={20} color={isDarkMode ? "#60a5fa" : "#007AFF"} />
          </View>
          <Text className={`flex-1 text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Ubah Password
          </Text>
          <AntDesign name="right" size={16} color={isDarkMode ? "#6b7280" : "#c7c7cc"} className="ml-2" />
        </TouchableOpacity>
      </View>
      {/* Preferences Section */}
      <View className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
          Preferensi
        </Text>
        <View className={`flex-row items-center py-3 border-b ${isDarkMode ? 'border-gray-700' : 'border-brand-gray-lighter'}`}>
          <View className={`w-9 h-9 rounded-lg ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} justify-center items-center mr-3`}>
            <Ionicons name={isDarkMode ? "moon" : "moon-outline"} size={20} color={isDarkMode ? "#60a5fa" : "#007AFF"} />
          </View>
          <Text className={`flex-1 text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Mode Gelap
          </Text>
          <Switch
            value={isDarkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: "#e5e5ea", true: isDarkMode ? "#3b82f6" : "#81b0ff" }}
            thumbColor={isDarkMode ? "#60a5fa" : "#f4f3f4"}
          />
        </View>
        <TouchableOpacity className="flex-row items-center py-3">
          <View className={`w-9 h-9 rounded-lg ${isDarkMode ? 'bg-blue-900' : 'bg-blue-100'} justify-center items-center mr-3`}>
            <Ionicons name="notifications-outline" size={20} color={isDarkMode ? "#60a5fa" : "#007AFF"} />
          </View>
          <Text className={`flex-1 text-base ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Notifikasi
          </Text>
          <AntDesign name="right" size={16} color={isDarkMode ? "#6b7280" : "#c7c7cc"} className="ml-2" />
        </TouchableOpacity>
      </View>
      {/* Account Section */}
      <View className={`rounded-xl mx-5 mb-5 p-5 shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <Text className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-400' : 'text-brand-gray'}`}>
          Akun
        </Text>
        <Button
          variant="danger"
          size="medium"
          onPress={handleLogout}
          className={`w-full rounded-lg py-3 ${isDarkMode ? 'bg-transparent' : 'bg-brand-red bg-opacity-10'}`}
          textClassName={isDarkMode ? "text-brand-red" : "text-black font-medium"}
          leftIcon={<Ionicons name="log-out-outline" size={24} color={isDarkMode ? "#dc3545" : "#000000"} />}
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
            backgroundColor: "#E600FF", // Use brand-purple from theme if preferred
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <View className={`flex-1 ${isDarkMode ? 'bg-gray-900' : 'bg-brand-background'} relative`}>
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
        {activeTab === "attendance" && (
          <Animated.View 
            entering={SlideInRight.duration(300)} 
            exiting={SlideOutLeft.duration(200)}
            className="flex-1"
          >
            {renderAttendanceTab()}
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

        {/* Photo Viewing Modal - Using the standalone component */}
        <PhotoViewModal
          photoUrl={selectedPhoto}
          isVisible={photoModalVisible}
          onClose={() => {
            setPhotoModalVisible(false);
            setSelectedPhoto(null);
          }}
        />

        {/* Bottom Navigation */}
        <View className={`flex-row justify-around items-center h-16 border-t shadow-inner ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-brand-gray-lighter'}`}>
          <AnimatedTabButton 
            isActive={activeTab === "home"}
            icon={activeTab === "home" ? "home" : "home-outline"}
            label="Beranda"
            onPress={() => setActiveTab("home")}
            isDarkMode={isDarkMode}
          />
          <AnimatedTabButton 
            isActive={activeTab === "attendance"}
            icon={activeTab === "attendance" ? "calendar" : "calendar-outline"}
            label="Kehadiran"
            onPress={() => setActiveTab("attendance")}
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

function AnimatedTabButton({ isActive, icon, label, onPress, isDarkMode }: AnimatedTabButtonProps) {
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
          ? `border-t-2 border-brand-purple ${isDarkMode ? 'bg-purple-900/30' : 'bg-purple-50'}` 
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
          color={isActive ? "#E600FF" : isDarkMode ? "#d1d5db" : "#8e8e93"}
        />
        <Text className={`text-xs mt-1 ${
          isActive 
            ? "text-brand-purple font-semibold" 
            : isDarkMode ? "text-gray-400" : "text-brand-gray"
        }`}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}