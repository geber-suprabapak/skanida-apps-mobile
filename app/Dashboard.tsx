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
} from "react-native";
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";

import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";

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

  const [activeTab, setActiveTab] = useState("home");
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
    <ScrollView className="flex-1 pb-32">
      {/* User greeting and info */}
      <View className="flex-row items-center p-4 bg-white mb-2 rounded-xl mx-4 mt-4 shadow">
        <View className="avatar bg-primary w-15 h-15 mr-4 flex items-center justify-center rounded-full">
          <Text className="text-white font-bold text-2xl">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-gray-500 text-sm">Selamat datang,</Text>
          <Text className="font-bold text-lg text-black">{user?.email || "Pengguna"}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-between px-4 mb-4">
        <TouchableOpacity
          className="btn btn-primary btn-large flex-1 mr-2 items-center"
          onPress={() => router.push("/attendance/AbsenceReport")}
        >
          <AntDesign name="scan1" size={24} color="#fff" />
          <Text className="ml-2">Absen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="btn btn-secondary btn-large flex-1 mx-1 items-center"
          onPress={() => setActiveTab("attendance")}
        >
          <MaterialIcons name="history" size={24} color="#fff" />
          <Text className="ml-2">Riwayat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="btn btn-tertiary btn-large flex-1 ml-2 items-center"
          onPress={() => setActiveTab("settings")}
        >
          <Ionicons name="settings-outline" size={24} color="#212121" />
          <Text className="ml-2">Pengaturan</Text>
        </TouchableOpacity>
      </View>

      {/* Recent attendance */}
      <View className="card mb-4">
        <Text className="heading-lg mb-4">Kehadiran Terbaru</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#E600FF" />
        ) : attendanceHistory.length > 0 ? (
          attendanceHistory.slice(0, 3).map((record) => (
            <View key={record.id} className="flex-row items-center py-3 border-b border-gray-100">
              <View className="mr-3">
                <AntDesign name="checkcircle" size={24} color="#28a745" />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-base text-black">{record.date}</Text>
                <Text className="text-gray-500 text-sm">{record.reason}</Text>
              </View>
              <Text className="text-gray-500 text-sm">
                {new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          ))
        ) : (
          <Text className="text-center text-gray-400 py-4">Belum ada riwayat kehadiran</Text>
        )}
        {attendanceHistory.length > 3 && (
          <TouchableOpacity 
            className="w-full text-center mt-3 border-t border-gray-100 pt-2"
            onPress={() => setActiveTab("attendance")}
          >
            <Text className="text-primary font-medium">Lihat Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <View className="card mb-4">
        <Text className="heading-lg mb-4">Pesan Penting</Text>
        {messages.length > 0 ? (
          messages.map((message) => (
            <TouchableOpacity 
              key={message.id} 
              className={`flex-row items-center py-3 border-b border-gray-100 relative ${!message.read ? 'bg-blue-50' : ''}`}
              onPress={() => markMessageAsRead(message.id)}
            >
              <View className="mr-3">
                <Ionicons 
                  name={message.read ? "mail-open-outline" : "mail-unread-outline"} 
                  size={24} 
                  color={message.read ? "#6c757d" : "#E600FF"} 
                />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-base text-black">{message.title}</Text>
                <Text className="text-gray-500 text-sm" numberOfLines={2}>
                  {message.content}
                </Text>
                <Text className="text-gray-400 text-xs mt-1">{message.date}</Text>
              </View>
              {!message.read && <View className="w-2.5 h-2.5 rounded-full bg-primary absolute top-3 right-0" />}
            </TouchableOpacity>
          ))
        ) : (
          <Text className="text-center text-gray-400 py-4">Tidak ada pesan baru</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderAttendanceTab = () => (
    <ScrollView className="flex-1 pb-32">
      <Text className="text-xl font-bold my-4 px-4 text-gray-900">Riwayat Kehadiran</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" className="mt-10" />
      ) : attendanceHistory.length > 0 ? (
        <View className="px-4">
          {attendanceHistory.map((record) => (
            <View key={record.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
              <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-gray-200">
                <Text className="text-base font-bold text-gray-900">{record.date}</Text>
                <Text className="text-sm text-gray-500">
                  {new Date(record.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <AntDesign name="checkcircle" size={20} color="#28a745" />
                  <Text className="text-sm text-green-600 ml-2">{record.reason}</Text>
                </View>
                {record.photo_url && (
                  <TouchableOpacity className="flex-row items-center" onPress={() => { }}>
                    <Image source={{ uri: record.photo_url }} className="w-10 h-10 rounded" resizeMode="cover" />
                    <Text className="text-xs text-blue-500 ml-2">Lihat Foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="flex-1 items-center justify-center p-10">
          <Ionicons name="document-text-outline" size={60} color="#d1d1d1" />
          <Text className="text-lg font-bold text-gray-500 mt-4">Belum Ada Data Kehadiran</Text>
          <Text className="text-sm text-gray-500 mt-2 text-center">
            Riwayat kehadiran Anda akan muncul di sini
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView className="flex-1 pb-32">
      <Text className="text-xl font-bold my-4 px-4 text-gray-900">Pengaturan</Text>
      <View className="bg-white rounded-xl mx-4 mb-4 p-4 shadow-sm">
        <Text className="text-sm font-medium text-gray-500 mb-4">Profil</Text>
        <View className="flex-row items-center mb-4 pb-4 border-b border-gray-200">
          <View className="w-16 h-16 rounded-full bg-blue-500 justify-center items-center mr-4">
            <Text className="text-2xl font-bold text-white">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{user?.email || "Pengguna"}</Text>
            <Text className="text-sm text-gray-500 mt-1">User ID: {user?.id?.substring(0,8) || "Unknown"}</Text>
          </View>
        </View>
        <TouchableOpacity className="flex-row items-center py-3 border-b border-gray-200">
          <View className="w-9 h-9 rounded-lg bg-blue-100 justify-center items-center mr-3">
            <Ionicons name="person-outline" size={24} color="#007AFF" />
          </View>
          <Text className="flex-1 text-base text-gray-900">Edit Profil</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" className="ml-2" />
        </TouchableOpacity>
        <TouchableOpacity className="flex-row items-center py-3 border-b border-gray-200">
          <View className="w-9 h-9 rounded-lg bg-blue-100 justify-center items-center mr-3">
            <Ionicons name="key-outline" size={24} color="#007AFF" />
          </View>
          <Text className="flex-1 text-base text-gray-900">Ubah Password</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" className="ml-2" />
        </TouchableOpacity>
      </View>
      <View className="bg-white rounded-xl mx-4 mb-4 p-4 shadow-sm">
        <Text className="text-sm font-medium text-gray-500 mb-4">Preferensi</Text>
        <View className="flex-row items-center py-3 border-b border-gray-200">
          <View className="w-9 h-9 rounded-lg bg-blue-100 justify-center items-center mr-3">
            <Ionicons name="moon-outline" size={24} color="#007AFF" />
          </View>
          <Text className="flex-1 text-base text-gray-900">Mode Gelap</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: "#e5e5ea", true: "#81b0ff" }}
            thumbColor={darkMode ? "#007AFF" : "#f4f3f4"}
          />
        </View>
        <TouchableOpacity className="flex-row items-center py-3 border-b border-gray-200">
          <View className="w-9 h-9 rounded-lg bg-blue-100 justify-center items-center mr-3">
            <Ionicons name="notifications-outline" size={24} color="#007AFF" />
          </View>
          <Text className="flex-1 text-base text-gray-900">Notifikasi</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" className="ml-2" />
        </TouchableOpacity>
      </View>
      <View className="bg-white rounded-xl mx-4 mb-4 p-4 shadow-sm">
        <Text className="text-sm font-medium text-gray-500 mb-4">Akun</Text>
        <TouchableOpacity className="flex-row items-center py-3 mt-1" onPress={handleLogout}>
          <View className="w-9 h-9 rounded-lg bg-red-100 justify-center items-center mr-3">
            <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          </View>
          <Text className="text-base text-red-600">Keluar</Text>
        </TouchableOpacity>
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
            backgroundColor: "#E600FF",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <View className="flex-1 bg-gray-100 relative">
        {/* Content based on active tab */}
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "attendance" && renderAttendanceTab()}
        {activeTab === "settings" && renderSettingsTab()}
        {/* Bottom Navigation */}
        <View className="flex-row justify-around items-center h-16 bg-white border-t border-gray-200">
          <TouchableOpacity
            className={`flex-1 justify-center items-center ${activeTab === "home" ? "border-t-4 border-purple-600 bg-purple-50" : ""}`}
            onPress={() => setActiveTab("home")}
          >
            <Ionicons 
              name={activeTab === "home" ? "home" : "home-outline"} 
              size={28} 
              color={activeTab === "home" ? "#E600FF" : "#8e8e93"} 
            />
            <Text className={`text-xs ${activeTab === "home" ? "text-purple-600" : "text-gray-500"}`}>Beranda</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 justify-center items-center ${activeTab === "attendance" ? "border-t-4 border-purple-600 bg-purple-50" : ""}`}
            onPress={() => setActiveTab("attendance")}
          >
            <Ionicons 
              name={activeTab === "attendance" ? "calendar" : "calendar-outline"} 
              size={28} 
              color={activeTab === "attendance" ? "#E600FF" : "#8e8e93"} 
            />
            <Text className={`text-xs ${activeTab === "attendance" ? "text-purple-600" : "text-gray-500"}`}>Kehadiran</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 justify-center items-center ${activeTab === "settings" ? "border-t-4 border-purple-600 bg-purple-50" : ""}`}
            onPress={() => setActiveTab("settings")}
          >
            <Ionicons 
              name={activeTab === "settings" ? "settings" : "settings-outline"} 
              size={28} 
              color={activeTab === "settings" ? "#E600FF" : "#8e8e93"} 
            />
            <Text className={`text-xs ${activeTab === "settings" ? "text-purple-600" : "text-gray-500"}`}>Pengaturan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}