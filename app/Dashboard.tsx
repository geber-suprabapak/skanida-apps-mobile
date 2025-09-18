// app/Dashboard.tsx
import { format } from "date-fns";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  BackHandler,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused, useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import * as Sentry from "@sentry/react-native";

// Import your reusable shadcn/ui components
import { Avatar } from "~/components/ui/avatar";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import AttendanceSuccessPopup from "~/components/ui/pop-up";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { useColorScheme } from "~/lib/useColorScheme";
import { History } from "~/lib/icons/History";
import { ClipboardPenLine } from "~/lib/icons/ClipboardPenLine";
import { Settings } from "~/lib/icons/Settings";
import { UserCheck } from "~/lib/icons/UserCheck";
import { Clock } from "~/lib/icons/Clock";
import { CheckCircle } from "~/lib/icons/CheckCircle";
import { AlertCircle } from "~/lib/icons/AlertCircle";
import { Bell } from "~/lib/icons/Bell";

// Fallback profile image in case avatar_url is not available
const fallbackProfileImage = require("../assets/muflih.jpg");

// Define interface for user profile data
interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Define interface for attendance data
interface AttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  totalWorkHours?: string;
  todayStatus: "present" | "absent" | "leave" | "pending";
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { isDarkColorScheme } = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    hasCheckedIn: false,
    hasCheckedOut: false,
    todayStatus: "pending",
  });
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused(); // Add isFocused hook

  // Success popup state
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState<{
    attendanceType: "present" | "home";
    time: string;
    processingTime?: number;
  } | null>(null);

  // Handle success popup from navigation params
  useEffect(() => {
    if (
      params.showSuccessPopup === "true" &&
      params.attendanceType &&
      params.successTime
    ) {
      setSuccessData({
        attendanceType: params.attendanceType as "present" | "home",
        time: params.successTime as string,
        processingTime: params.processingTime
          ? parseInt(params.processingTime as string)
          : undefined,
      });
      setShowSuccessPopup(true);

      // Clear params to prevent popup from showing again
      router.setParams({
        showSuccessPopup: undefined,
        attendanceType: undefined,
        successTime: undefined,
        processingTime: undefined,
      });
    }
  }, [params, router]);

  // Show alpha release popup only once
  useEffect(() => {
    const showAlphaReleaseAlert = async () => {
      try {
        const hasSeenAlert = await AsyncStorage.getItem(
          "alpha_release_alert_shown",
        );

        if (!hasSeenAlert) {
          Alert.alert(
            "🚧 Alpha Release",
            "Aplikasi ini masih dalam tahap pengembangan (Alpha). Fitur dan data dapat berubah sewaktu-waktu. Mohon laporkan bug atau masukan ke tim pengembang. Terima kasih atas partisipasinya!",
            [
              {
                text: "Saya Mengerti",
                style: "default",
                onPress: async () => {
                  await AsyncStorage.setItem(
                    "alpha_release_alert_shown",
                    "true",
                  );
                },
              },
            ],
            { cancelable: false },
          );
        }
      } catch (error) {
        console.warn("Failed to check/set alpha release alert flag:", error);
      }
    };

    showAlphaReleaseAlert();
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  // Fetch profile data from Supabase
  const fetchProfileData = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user?.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          console.log("Dashboard: No profile data found for user:", user?.id);
          setProfileData(null);
        } else {
          console.error(
            "Dashboard: Error fetching profile data:",
            error.message,
          );
          setProfileData(null);
        }
      } else if (data) {
        console.log("Dashboard: Profile data found:", data);
        setProfileData(data as UserProfile);
      } else {
        console.log("Dashboard: No profile data found for user:", user?.id);
        setProfileData(null);
      }
    } catch (err: any) {
      console.error(
        "Dashboard: Exception during user_profiles data fetch:",
        err.message,
      );
      setProfileData(null);
    }
  }, [user]);

  // Fetch attendance data for today
  const fetchAttendanceData = useCallback(async () => {
    if (!user) return;

    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Fetch today's attendance
      const { data: todayAttendance } = await supabase
        .from("absences")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: true });

      // Fetch leave requests for today
      const { data: leaveRequests } = await supabase
        .from("perizinan")
        .select("approval_status, kategori_izin, status")
        .eq("user_id", user.id)
        .gte("tanggal", `${today}T00:00:00.000Z`)
        .lt("tanggal", `${today}T23:59:59.999Z`);

      let hasCheckedIn = false;
      let hasCheckedOut = false;
      let checkInTime = "";
      let checkOutTime = "";
      let todayStatus: "present" | "absent" | "leave" | "pending" = "pending";

      // Check for leave requests first (they take priority)
      if (leaveRequests && leaveRequests.length > 0) {
        // Check if there's any leave request for today (any submitted request counts)
        const hasLeaveRequest = leaveRequests.length > 0;
        if (hasLeaveRequest) {
          todayStatus = "leave";
        }
      }

      // Only check attendance if no leave request exists
      if (
        todayStatus !== "leave" &&
        todayAttendance &&
        todayAttendance.length > 0
      ) {
        todayAttendance.forEach((record) => {
          if (record.status === "Hadir" || record.status === "Datang") {
            hasCheckedIn = true;
            checkInTime = record.created_at;
          } else if (record.status === "Pulang") {
            hasCheckedOut = true;
            checkOutTime = record.created_at;
          }
        });

        if (hasCheckedIn) {
          todayStatus = "present";
        }
      }

      // If no attendance and no leave request, mark as absent
      if (
        todayStatus === "pending" &&
        !todayAttendance?.length &&
        !leaveRequests?.length
      ) {
        todayStatus = "absent";
      }

      const totalWorkHours =
        hasCheckedIn && hasCheckedOut
          ? calculateWorkHours(checkInTime, checkOutTime)
          : undefined;

      setAttendanceStatus({
        hasCheckedIn,
        hasCheckedOut,
        checkInTime,
        checkOutTime,
        totalWorkHours,
        todayStatus,
      });
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    }
  }, [user]);

  // Fetch profile and attendance data when component mounts or user changes
  useEffect(() => {
    if (user) {
      console.log("Dashboard: Fetching initial data for user:", user?.id);
      fetchProfileData();
      fetchAttendanceData();
    }
  }, [user, fetchProfileData, fetchAttendanceData]);

  // Handle success popup close
  const handleSuccessPopupClose = useCallback(() => {
    setShowSuccessPopup(false);
    setSuccessData(null);
    // Refresh attendance data after successful attendance
    if (isFocused) {
      fetchAttendanceData();
    }
  }, [isFocused, fetchAttendanceData]);

  // Helper function to calculate work hours
  const calculateWorkHours = (checkIn: string, checkOut: string): string => {
    try {
      const checkInTime = new Date(checkIn);
      const checkOutTime = new Date(checkOut);
      const diffMs = checkOutTime.getTime() - checkInTime.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}j ${minutes}m`;
    } catch {
      return "0j 0m";
    }
  };

  // Refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfileData(), fetchAttendanceData()]);
    setRefreshing(false);
  }, [fetchProfileData, fetchAttendanceData]);

  // Get user's display name prioritizing profile data, then falling back to metadata
  // This will be "Pengguna" if no profile data exists, which should trigger our redirect
  const displayName = profileData?.full_name || "";

  // Get user's avatar URL from profile data or from metadata
  const avatarUrl = user?.user_metadata?.avatar_url;

  // --- Navigation Handlers ---
  const navigateToCheckIn = () => router.push("/attendance/AbsenceReport"); // Adjust route if needed
  const navigateToHistory = async () => {
    try {
      // Force refresh current month cache before navigating
      if (user?.id) {
        await attendanceCache.forceRefreshCurrentMonth(user.id);
      }
      router.push("/extra/riwayat");
    } catch (error) {
      console.error("Error preparing riwayat navigation:", error);
      // Still navigate even if cache refresh fails
      router.push("/extra/riwayat");
    }
  };
  const navigateToSettings = () => router.push("/extra/pengaturan");
  const navigateToPerizinan = () => router.push("/perizinan/izin"); // New handler for Perizinan

  // Prevent back navigation
  useEffect(() => {
    const backAction = () => {
      // For Dashboard, show exit confirmation instead of navigating back
      Alert.alert(
        "Keluar Aplikasi",
        "Apakah Anda yakin ingin keluar dari aplikasi?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Keluar",
            style: "destructive",
            onPress: () => BackHandler.exitApp(),
          },
        ],
      );
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  // Get status badge color and text
  const getStatusBadge = () => {
    switch (attendanceStatus.todayStatus) {
      case "present":
        return {
          color: "bg-green-500",
          text: "Hadir",
          textColor: "text-white",
        };
      case "leave":
        return {
          color: "bg-yellow-500",
          text: "Izin",
          textColor: "text-white",
        };
      case "absent":
        return {
          color: "bg-red-500",
          text: "Tidak Hadir",
          textColor: "text-white",
        };
      default:
        return {
          color: "bg-gray-500",
          text: "Pending",
          textColor: "text-white",
        };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false, // Disable swipe back on iOS
        }}
      />
      {/* Apply dynamic background based on theme */}
      <SafeAreaView
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
        edges={["top"]}
      >
        {/* Main container with theme-based background */}
        <ScrollView
          className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* --- Header Section --- */}
          <View
            className={`px-6 pt-4 pb-6 ${isDarkColorScheme ? "bg-gray-900" : "bg-white"}`}
          >
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center flex-1">
                <Avatar
                  size="md"
                  fallback={displayName.charAt(0).toUpperCase() || "?"}
                  className="mr-3"
                  source={
                    avatarUrl ||
                    Image.resolveAssetSource(fallbackProfileImage).uri
                  }
                />
                <View className="flex-1">
                  <Text
                    className={`text-lg font-semibold ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    {displayName}
                  </Text>
                  <Text
                    className={`text-sm ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {format(currentTime, "EEEE, dd MMMM yyyy")}
                  </Text>
                </View>
              </View>

              {/* Waktu Sekarang - In header row */}
              <View className="flex-row items-center mr-3">
                <View
                  className={`px-3 py-2 rounded-lg ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-50"}`}
                >
                  <View className="flex-row items-center">
                    <Clock
                      size={16}
                      color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                    />
                    <Text
                      className={`ml-1 text-xs font-medium ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Waktu Sekarang
                    </Text>
                  </View>
                  <Text
                    className={`text-sm font-bold text-center mt-1 ${isDarkColorScheme ? "text-blue-400" : "text-blue-600"}`}
                  >
                    {format(currentTime, "HH:mm:ss")}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Sentry.showFeedbackWidget();
                }}
                className={`p-2 rounded-full ${isDarkColorScheme ? "bg-gray-800" : "bg-gray-100"}`}
              >
                <Bell
                  size={20}
                  color={isDarkColorScheme ? "#ffffff" : "#374151"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Today's Status Card --- */}
          <View className="px-6 mb-6">
            <Card
              className={`p-4 ${isDarkColorScheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text
                  className={`text-lg font-semibold ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                >
                  Status Hari Ini
                </Text>
                <Badge
                  className={`${statusBadge.color} ${statusBadge.textColor}`}
                >
                  {statusBadge.text}
                </Badge>
              </View>

              <View className="space-y-3">
                {/* Check In Status */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {attendanceStatus.hasCheckedIn ? (
                      <CheckCircle size={20} color="#16a34a" />
                    ) : (
                      <AlertCircle size={20} color="#dc2626" />
                    )}
                    <Text
                      className={`ml-2 ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Absen Masuk
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {attendanceStatus.checkInTime
                      ? format(new Date(attendanceStatus.checkInTime), "HH:mm")
                      : "Belum absen"}
                  </Text>
                </View>

                {/* Check Out Status */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {attendanceStatus.hasCheckedOut ? (
                      <CheckCircle size={20} color="#16a34a" />
                    ) : (
                      <AlertCircle size={20} color="#dc2626" />
                    )}
                    <Text
                      className={`ml-2 ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
                    >
                      Absen Pulang
                    </Text>
                  </View>
                  <Text
                    className={`text-sm ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    {attendanceStatus.checkOutTime
                      ? format(new Date(attendanceStatus.checkOutTime), "HH:mm")
                      : "Belum absen"}
                  </Text>
                </View>

                {/* Work Hours */}
                {attendanceStatus.totalWorkHours && (
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Clock size={20} color="#3b82f6" />
                      <Text
                        className={`ml-2 ${isDarkColorScheme ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Total Jam Di Sekolah
                      </Text>
                    </View>
                    <Text
                      className={`text-sm font-medium ${isDarkColorScheme ? "text-blue-400" : "text-blue-600"}`}
                    >
                      {attendanceStatus.totalWorkHours}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </View>

          {/* --- Quick Actions (Moved up from Statistics location) --- */}
          <View className="px-6 mb-6">
            <Text
              className={`text-lg font-semibold mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
            >
              Aksi Cepat
            </Text>

            {/* Large Square Primary Action - Attendance (Centered) */}
            <View className="items-center mb-4">
              <TouchableOpacity
                onPress={navigateToCheckIn}
                className="w-48"
                activeOpacity={0.8}
              >
                <Card
                  className={`aspect-square ${isDarkColorScheme ? "bg-blue-600 border-blue-500" : "bg-blue-600 border-blue-500"}`}
                >
                  <View className="flex-1 items-center justify-center p-4">
                    <UserCheck size={32} color="white" />
                    <Text className="text-white font-semibold text-lg mt-2 text-center">
                      {!attendanceStatus.hasCheckedIn
                        ? "Absen Masuk"
                        : !attendanceStatus.hasCheckedOut
                          ? "Absen Pulang"
                          : "Lihat Absensi"}
                    </Text>
                    <Text className="text-blue-100 text-sm text-center mt-1">
                      {!attendanceStatus.hasCheckedIn
                        ? "Mulai hari sekolah"
                        : !attendanceStatus.hasCheckedOut
                          ? "Selesaikan hari"
                          : "Absensi selesai"}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            </View>

            {/* Secondary Actions Grid */}

            <View className="flex-row space-x-3 gap-2">
              <TouchableOpacity
                onPress={navigateToHistory}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card
                  className={`p-4 ${isDarkColorScheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                >
                  <History
                    size={24}
                    color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                  />
                  <Text
                    className={`mt-2 font-medium ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    Riwayat
                  </Text>
                  <Text
                    className={`text-xs ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Lihat absensi
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToPerizinan}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card
                  className={`p-4 ${isDarkColorScheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                >
                  <ClipboardPenLine
                    size={24}
                    color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                  />
                  <Text
                    className={`mt-2 font-medium ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    Perizinan
                  </Text>
                  <Text
                    className={`text-xs ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Ajukan izin
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToSettings}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card
                  className={`p-4 ${isDarkColorScheme ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}
                >
                  <Settings
                    size={24}
                    color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                  />
                  <Text
                    className={`mt-2 font-medium ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    Pengaturan
                  </Text>
                  <Text
                    className={`text-xs ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Kelola akun
                  </Text>
                </Card>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* --- Footer Section --- */}
        <View
          className={`items-center px-6 py-3 border-t ${
            isDarkColorScheme
              ? "bg-gray-900 border-gray-700"
              : "bg-white border-gray-200"
          }`}
        >
          <Text
            className={`text-s font-bold ${isDarkColorScheme ? "text-gray-500" : "text-gray-400"}`}
          >
            v1.6.1-internal.2 | Branch: develop
          </Text>
        </View>
      </SafeAreaView>

      {/* Success Popup */}
      {successData && (
        <AttendanceSuccessPopup
          visible={showSuccessPopup}
          onClose={handleSuccessPopupClose}
          attendanceType={successData.attendanceType}
          time={successData.time}
          processingTime={successData.processingTime}
        />
      )}
    </>
  );
}
