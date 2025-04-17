// app/Dashboard.tsx
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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
    <ScrollView style={styles.tabContent}>
      {/* User greeting and info */}
      <View style={styles.userInfoContainer}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View style={styles.userTextContainer}>
          <Text style={styles.welcomeText}>Selamat datang,</Text>
          <Text style={styles.userNameText}>{user?.email || "Pengguna"}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/attendance/AbsenceReport")}
        >
          <AntDesign name="scan1" size={24} color="#007AFF" />
          <Text style={styles.quickActionText}>Absen</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setActiveTab("attendance")}
        >
          <MaterialIcons name="history" size={24} color="#28a745" />
          <Text style={styles.quickActionText}>Riwayat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => setActiveTab("settings")}
        >
          <Ionicons name="settings-outline" size={24} color="#6c757d" />
          <Text style={styles.quickActionText}>Pengaturan</Text>
        </TouchableOpacity>
      </View>

      {/* Recent attendance */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Kehadiran Terbaru</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : attendanceHistory.length > 0 ? (
          attendanceHistory.slice(0, 3).map((record) => (
            <View key={record.id} style={styles.attendanceItem}>
              <View style={styles.attendanceIconContainer}>
                <AntDesign name="checkcircle" size={24} color="#28a745" />
              </View>
              <View style={styles.attendanceDetails}>
                <Text style={styles.attendanceDate}>{record.date}</Text>
                <Text style={styles.attendanceReason}>{record.reason}</Text>
              </View>
              <Text style={styles.attendanceTime}>
                {new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Belum ada riwayat kehadiran</Text>
        )}
        
        {attendanceHistory.length > 3 && (
          <TouchableOpacity 
            style={styles.viewAllButton}
            onPress={() => setActiveTab("attendance")}
          >
            <Text style={styles.viewAllText}>Lihat Semua</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Messages */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Pesan Penting</Text>
        
        {messages.length > 0 ? (
          messages.map((message) => (
            <TouchableOpacity 
              key={message.id} 
              style={[
                styles.messageItem, 
                !message.read && styles.unreadMessage
              ]}
              onPress={() => markMessageAsRead(message.id)}
            >
              <View style={styles.messageIconContainer}>
                <Ionicons 
                  name={message.read ? "mail-open-outline" : "mail-unread-outline"} 
                  size={24} 
                  color={message.read ? "#6c757d" : "#007AFF"} 
                />
              </View>
              <View style={styles.messageContent}>
                <Text style={styles.messageTitle}>{message.title}</Text>
                <Text style={styles.messagePreview} numberOfLines={2}>
                  {message.content}
                </Text>
                <Text style={styles.messageDate}>{message.date}</Text>
              </View>
              {!message.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Tidak ada pesan baru</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderAttendanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Riwayat Kehadiran</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
      ) : attendanceHistory.length > 0 ? (
        <View style={styles.attendanceHistoryContainer}>
          {attendanceHistory.map((record) => (
            <View key={record.id} style={styles.historyItem}>
              <View style={styles.historyDateContainer}>
                <Text style={styles.historyDate}>{record.date}</Text>
                <Text style={styles.historyTime}>
                  {new Date(record.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </Text>
              </View>
              
              <View style={styles.historyDetails}>
                <View style={styles.historyStatusContainer}>
                  <AntDesign name="checkcircle" size={20} color="#28a745" />
                  <Text style={styles.historyStatus}>{record.reason}</Text>
                </View>
                
                {record.photo_url && (
                  <TouchableOpacity 
                    style={styles.photoPreviewContainer}
                    onPress={() => {/* Show full photo */}}
                  >
                    <Image 
                      source={{ uri: record.photo_url }} 
                      style={styles.photoThumbnail} 
                      resizeMode="cover" 
                    />
                    <Text style={styles.viewPhotoText}>Lihat Foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={60} color="#d1d1d1" />
          <Text style={styles.emptyTitle}>Belum Ada Data Kehadiran</Text>
          <Text style={styles.emptySubtitle}>
            Riwayat kehadiran Anda akan muncul di sini
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSettingsTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.tabTitle}>Pengaturan</Text>
      
      {/* Profile Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Profil</Text>
        
        <View style={styles.profileInfoContainer}>
          <View style={styles.profileAvatarContainer}>
            <Text style={styles.profileAvatarText}>
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <View style={styles.profileTextContainer}>
            <Text style={styles.profileNameText}>{user?.email || "Pengguna"}</Text>
            <Text style={styles.profileIdText}>User ID: {user?.id?.substring(0, 8) || "Unknown"}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="person-outline" size={24} color="#007AFF" />
          </View>
          <Text style={styles.settingLabel}>Edit Profil</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" style={styles.settingsArrow} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="key-outline" size={24} color="#007AFF" />
          </View>
          <Text style={styles.settingLabel}>Ubah Password</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" style={styles.settingsArrow} />
        </TouchableOpacity>
      </View>
      
      {/* Preferences Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Preferensi</Text>
        
        <View style={styles.settingsItem}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="moon-outline" size={24} color="#007AFF" />
          </View>
          <Text style={styles.settingLabel}>Mode Gelap</Text>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: "#e5e5ea", true: "#81b0ff" }}
            thumbColor={darkMode ? "#007AFF" : "#f4f3f4"}
          />
        </View>
        
        <TouchableOpacity style={styles.settingsItem}>
          <View style={styles.settingIconContainer}>
            <Ionicons name="notifications-outline" size={24} color="#007AFF" />
          </View>
          <Text style={styles.settingLabel}>Notifikasi</Text>
          <AntDesign name="right" size={16} color="#c7c7cc" style={styles.settingsArrow} />
        </TouchableOpacity>
      </View>
      
      {/* Account Section */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Akun</Text>
        
        
        <TouchableOpacity 
          style={[styles.settingsItem, styles.logoutItem]} 
          onPress={handleLogout}
        >
          <View style={[styles.settingIconContainer, styles.logoutIcon]}>
            <Ionicons name="log-out-outline" size={24} color="#dc3545" />
          </View>
          <Text style={styles.logoutText}>Keluar</Text>
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
            backgroundColor: "#007AFF",
          },
          headerTintColor: "#fff",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />

      <View style={styles.container}>
        {/* Content based on active tab */}
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "attendance" && renderAttendanceTab()}
        {activeTab === "settings" && renderSettingsTab()}
        
        {/* Bottom Navigation */}
        <View style={styles.bottomNavigation}>
          <TouchableOpacity
            style={[styles.navItem, activeTab === "home" && styles.activeNavItem]}
            onPress={() => setActiveTab("home")}
          >
            <Ionicons 
              name={activeTab === "home" ? "home" : "home-outline"} 
              size={28} 
              color={activeTab === "home" ? "#007AFF" : "#8e8e93"} 
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === "home" && styles.activeNavLabel,
              ]}
            >
              Beranda
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navItem, activeTab === "attendance" && styles.activeNavItem]}
            onPress={() => setActiveTab("attendance")}
          >
            <Ionicons 
              name={activeTab === "attendance" ? "calendar" : "calendar-outline"} 
              size={28} 
              color={activeTab === "attendance" ? "#007AFF" : "#8e8e93"} 
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === "attendance" && styles.activeNavLabel,
              ]}
            >
              Kehadiran
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navItem, activeTab === "settings" && styles.activeNavItem]}
            onPress={() => setActiveTab("settings")}
          >
            <Ionicons 
              name={activeTab === "settings" ? "settings" : "settings-outline"} 
              size={28} 
              color={activeTab === "settings" ? "#007AFF" : "#8e8e93"} 
            />
            <Text
              style={[
                styles.navLabel,
                activeTab === "settings" && styles.activeNavLabel,
              ]}
            >
              Pengaturan
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f7",
    position: "relative",
  },
  tabContent: {
    flex: 1,
    paddingBottom: 120, // Increased padding to ensure content is visible above bottom nav
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginVertical: 16,
    paddingHorizontal: 16,
    color: "#1c1c1e",
  },

  // Home Tab
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
    marginBottom: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
  },
  userTextContainer: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: "#8e8e93",
  },
  userNameText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1c1c1e",
  },
  quickActionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    width: "30%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    color: "#8e8e93",
  },
  sectionContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#1c1c1e",
  },
  attendanceItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
  },
  attendanceIconContainer: {
    marginRight: 12,
  },
  attendanceDetails: {
    flex: 1,
  },
  attendanceDate: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
  },
  attendanceReason: {
    fontSize: 14,
    color: "#8e8e93",
  },
  attendanceTime: {
    fontSize: 14,
    color: "#8e8e93",
  },
  emptyText: {
    textAlign: "center",
    color: "#8e8e93",
    paddingVertical: 16,
  },
  viewAllButton: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f2f2f7",
  },
  viewAllText: {
    color: "#007AFF",
    fontSize: 14,
    fontWeight: "500",
  },
  messageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
    position: "relative",
  },
  unreadMessage: {
    backgroundColor: "#f0f8ff",
  },
  messageIconContainer: {
    marginRight: 12,
  },
  messageContent: {
    flex: 1,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1c1c1e",
  },
  messagePreview: {
    fontSize: 14,
    color: "#8e8e93",
    marginTop: 2,
  },
  messageDate: {
    fontSize: 12,
    color: "#8e8e93",
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#007AFF",
    position: "absolute",
    top: 12,
    right: 0,
  },

  // Attendance History Tab
  attendanceHistoryContainer: {
    paddingHorizontal: 16,
  },
  historyItem: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyDateContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
    paddingBottom: 8,
  },
  historyDate: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1c1c1e",
  },
  historyTime: {
    fontSize: 14,
    color: "#8e8e93",
  },
  historyDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyStatus: {
    fontSize: 14,
    color: "#28a745",
    marginLeft: 8,
  },
  photoPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  photoThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  viewPhotoText: {
    fontSize: 12,
    color: "#007AFF",
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#8e8e93",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8e8e93",
    marginTop: 8,
    textAlign: "center",
  },
  loader: {
    marginTop: 40,
  },

  // Settings Tab
  settingsSection: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingsSectionTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8e8e93",
    marginBottom: 16,
  },
  profileInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
  },
  profileAvatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
  },
  profileTextContainer: {
    flex: 1,
  },
  profileNameText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1c1c1e",
  },
  profileIdText: {
    fontSize: 14,
    color: "#8e8e93",
    marginTop: 4,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f7",
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: "#1c1c1e",
  },
  settingsArrow: {
    marginLeft: 8,
  },
  languageSelector: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e5ea",
    overflow: "hidden",
  },
  languageOption: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#f2f2f7",
  },
  activeLanguage: {
    backgroundColor: "#007AFF",
  },
  languageText: {
    fontSize: 14,
    color: "#8e8e93",
  },
  activeLanguageText: {
    color: "#ffffff",
  },
  logoutItem: {
    borderBottomWidth: 0,
    marginTop: 4,
    marginBottom: 8, // Added margin bottom for better spacing
  },
  logoutIcon: {
    backgroundColor: "rgba(220, 53, 69, 0.1)",
  },
  logoutText: {
    fontSize: 16,
    color: "#dc3545",
  },

  // Bottom Navigation
  bottomNavigation: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80, // Ditingkatkan dari 70 menjadi 80
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10, // Ditingkatkan untuk Android
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    height: "100%",
    paddingVertical: 10, // Menambahkan padding
  },
  activeNavItem: {
    borderTopWidth: 3, // Ditingkatkan dari 2 menjadi 3
    borderTopColor: "#007AFF",
    backgroundColor: "rgba(0, 122, 255, 0.05)", // Latar belakang untuk tab aktif
  },
  navLabel: {
    marginTop: 4,
    fontSize: 13, // Ditingkatkan dari 12 menjadi 13
    color: "#8e8e93",
    fontWeight: "500", // Menambahkan ketebalan
  },
  activeNavLabel: {
    color: "#007AFF",
    fontWeight: "bold", // Membuat teks lebih tebal untuk tab aktif
  },
});