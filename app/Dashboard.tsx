// app/Dashboard.tsx
import { format, differenceInMinutes } from "date-fns";
import { id } from "date-fns/locale";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import * as Sentry from "@sentry/react-native";

// Import your reusable shadcn/ui components
import { Avatar } from "~/components/ui/avatar";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import AttendanceSuccessPopup from "~/components/ui/pop-up";
import useAuthStore from "~/store/authStore";
import useTimeSyncStore from "~/store/timeSyncStore";
import { supabase } from "~/utils/supabase";
import { attendanceCache } from "~/utils/attendanceCache";
import { Icon } from "~/components/ui/icon";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";
import {
  Clock,
  Bell,
  CheckCircle,
  AlertCircle,
  UserCheck,
  History,
  ClipboardPenLine,
  Settings,
  UserRound,
  WifiOff,
  Wifi,
} from "lucide-react-native";

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
  todayStatus: "present" | "absent" | "leave" | "pending" | "alpha";
  statusNote?: string;
  isLate: boolean;
  isAlpha: boolean;
}

interface DailySchedule {
  hari: string;
  mulai_masuk: string | null;
  selesai_masuk: string | null;
  kompensasi_waktu: number | null;
  mulai_pulang: string | null;
  selesai_pulang: string | null;
}

// Define interface for RPC check_absensi_status result
interface AbsensiCheckResult {
  status_code:
    | "VALID"
    | "OUT_OF_RANGE"
    | "NOT_SCHEDULED"
    | "ALREADY_COMPLETED"
    | "TIME_OUT"
    | "FAILED_LOCATION";
  required_action: "present" | "home" | "none";
  location_name: string;
  distance_m: number;
  message: string;
}

// Define interface for validation status state
interface ValidationStatus {
  canCheckIn: boolean;
  actionType: "present" | "home" | "none";
  message: string;
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const syncStatus = useTimeSyncStore((state) => state.status);
  const syncSource = useTimeSyncStore((state) => state.syncSource);
  const driftDetected = useTimeSyncStore((state) => state.driftDetected);
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currentTime, setCurrentTime] = useState(timeSync.getSyncedTime());
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    hasCheckedIn: false,
    hasCheckedOut: false,
    todayStatus: "pending",
    statusNote: undefined,
    isLate: false,
    isAlpha: false,
  });
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused(); // Add isFocused hook

  // Validation status for live schedule checking
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({
    canCheckIn: false,
    actionType: "none",
    message: "Memeriksa status jadwal...",
  });

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

  // Sync time with server on mount and set up interval for updating time
  useEffect(() => {
    // Initial sync handled by _layout.tsx
    // Update current time every second
    // Date object automatically displays in device timezone (WIB)
    const timerId = setInterval(() => {
      setCurrentTime(timeSync.getSyncedTime());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  // Re-sync when screen is focused
  useEffect(() => {
    if (isFocused) {
      timeSync.syncWithServer().then((success) => {
        if (success) {
          setCurrentTime(timeSync.getSyncedTime());
        }
      });
    }
  }, [isFocused]);

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
      const now = timeSync.getSyncedTime();
      const today = formatDateWIB(now);
      const dayName = format(now, "EEEE", { locale: id });
      const normalizedDay =
        dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();

      const [
        { data: todayAttendance },
        { data: leaveRequests },
        { data: scheduleRows },
      ] = await Promise.all([
        supabase
          .from("absences")
          .select("status, created_at")
          .eq("user_id", user.id)
          .eq("date", today)
          .order("created_at", { ascending: true }),
        supabase
          .from("perizinan")
          .select("approval_status, kategori_izin, status")
          .eq("user_id", user.id)
          .gte("tanggal", `${today}T00:00:00.000Z`)
          .lt("tanggal", `${today}T23:59:59.999Z`),
        supabase
          .from("jadwal_absensi")
          .select(
            "hari, mulai_masuk, selesai_masuk, kompensasi_waktu, mulai_pulang, selesai_pulang",
          )
          .eq("is_active", true)
          .ilike("hari", normalizedDay)
          .limit(1),
      ]);

      const schedule =
        scheduleRows && scheduleRows.length > 0
          ? (scheduleRows[0] as DailySchedule)
          : null;

      const ensureTimeFormat = (value: string) =>
        value.length === 5 ? `${value}:00` : value;

      const combineWithToday = (timeValue?: string | null) => {
        if (!timeValue) return null;
        const sanitized = ensureTimeFormat(timeValue);
        return new Date(`${today}T${sanitized}+07:00`);
      };

      let hasCheckedIn = false;
      let hasCheckedOut = false;
      let checkInTime = "";
      let checkOutTime = "";
      let todayStatus: AttendanceStatus["todayStatus"] = "pending";
      let statusNote: string | undefined;
      let isLate = false;
      let isAlpha = false;

      // Check for leave requests first (they take priority)
      if (leaveRequests && leaveRequests.length > 0) {
        todayStatus = "leave";
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

      const checkInCutoff = schedule
        ? combineWithToday(schedule.selesai_masuk)
        : null;
      const kompensasiDeadline =
        checkInCutoff && schedule
          ? new Date(
              checkInCutoff.getTime() +
                Number(schedule.kompensasi_waktu ?? 0) * 60 * 1000,
            )
          : null;

      if (schedule && todayStatus !== "leave") {
        // Handle late or alpha conditions when user has checked in
        if (hasCheckedIn && checkInCutoff) {
          const checkInDate = new Date(checkInTime);
          if (checkInDate > checkInCutoff) {
            isLate = true;
            const lateMinutes = Math.max(
              1,
              differenceInMinutes(checkInDate, checkInCutoff),
            );
            statusNote = `Terlambat ${lateMinutes} menit`;
          }
        }

        // Handle late or alpha conditions when user hasn't checked in yet
        if (!hasCheckedIn && checkInCutoff) {
          if (
            kompensasiDeadline &&
            now.getTime() > checkInCutoff.getTime() &&
            now.getTime() <= kompensasiDeadline.getTime()
          ) {
            isLate = true;
            todayStatus = "pending";
            statusNote = "Belum absen - dalam waktu kompensasi";
          } else if (
            (!kompensasiDeadline ||
              now.getTime() > kompensasiDeadline.getTime()) &&
            now.getTime() > checkInCutoff.getTime()
          ) {
            isAlpha = true;
            todayStatus = "alpha";
            statusNote = "Alpha - tidak absen masuk";
          }
        }
      }

      // If still pending with no data and not within late/alpha window, mark absent
      if (
        todayStatus === "pending" &&
        !hasCheckedIn &&
        !leaveRequests?.length &&
        !schedule
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
        statusNote,
        isLate,
        isAlpha,
      });
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    }
  }, [user]);

  // Check live validation status using RPC
  const checkLiveValidationStatus = useCallback(async () => {
    if (!user?.id) {
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: "User tidak ditemukan",
      });
      return;
    }

    if (attendanceStatus.isAlpha) {
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: "Anda sudah dinyatakan alpha untuk hari ini",
      });
      return;
    }

    try {
      // Request location permission
      let { status } = await Location.getForegroundPermissionsAsync();

      if (status !== "granted") {
        const result = await Location.requestForegroundPermissionsAsync();
        status = result.status;

        if (status !== "granted") {
          setValidationStatus({
            canCheckIn: false,
            actionType: "none",
            message: "Izin lokasi ditolak. Aktifkan untuk melanjutkan.",
          });
          return;
        }
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (!location) {
        setValidationStatus({
          canCheckIn: false,
          actionType: "none",
          message: "Gagal mendapatkan lokasi. Pastikan GPS aktif.",
        });
        return;
      }

      const { latitude, longitude } = location.coords;

      // Call RPC function
      const { data, error } = await supabase.rpc("check_absensi_status", {
        p_user_id: user.id,
        p_user_lat: latitude,
        p_user_lon: longitude,
      });

      if (error) {
        console.error("Error calling check_absensi_status:", error);
        setValidationStatus({
          canCheckIn: false,
          actionType: "none",
          message: "Gagal memeriksa status absensi",
        });
        return;
      }

      const result = data as AbsensiCheckResult;

      // Interpret the result
      setValidationStatus({
        canCheckIn: result.status_code === "VALID",
        actionType: result.required_action,
        message: result.message,
      });
    } catch (error) {
      console.error("Exception during validation check:", error);
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: "Terjadi kesalahan saat memeriksa status",
      });
    }
  }, [user, attendanceStatus.isAlpha]);

  // Fetch profile and attendance data when component mounts or user changes
  useEffect(() => {
    if (user) {
      console.log("Dashboard: Fetching initial data for user:", user?.id);
      fetchProfileData();
      fetchAttendanceData();
    }
  }, [user, fetchProfileData, fetchAttendanceData]);

  // Polling for live validation status every 15 seconds when screen is focused
  useEffect(() => {
    if (!isFocused || !user?.id) return;

    // Initial check when screen becomes focused
    checkLiveValidationStatus();

    // Set up interval for polling every 15 seconds
    const validationInterval = setInterval(() => {
      checkLiveValidationStatus();
    }, 15000); // 15 seconds

    // Cleanup interval on unmount or when focus changes
    return () => clearInterval(validationInterval);
  }, [isFocused, user?.id, checkLiveValidationStatus]);

  // Handle success popup close
  const handleSuccessPopupClose = useCallback(() => {
    setShowSuccessPopup(false);
    setSuccessData(null);
    // Refresh attendance data after successful attendance
    if (isFocused) {
      fetchAttendanceData();
    }
  }, [isFocused, fetchAttendanceData]);

  useEffect(() => {
    if (attendanceStatus.isAlpha) {
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: "Anda sudah dinyatakan alpha untuk hari ini",
      });
    }
  }, [attendanceStatus.isAlpha]);

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
    await Promise.all([
      fetchProfileData(),
      fetchAttendanceData(),
      checkLiveValidationStatus(), // Refresh validation status, location, and time
      timeSync.forceSyncWithServer().then((success) => {
        if (success) {
          setCurrentTime(timeSync.getSyncedTime());
        }
      }),
    ]);
    setRefreshing(false);
  }, [fetchProfileData, fetchAttendanceData, checkLiveValidationStatus]);

  // Get user's display name prioritizing profile data, then falling back to metadata
  // This will be "Pengguna" if no profile data exists, which should trigger our redirect
  const rawName =
    profileData?.full_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    "";

  const displayName = rawName
    ? rawName.split(" ").slice(0, 2).join(" ")
    : "Pengguna";

  // Get user's avatar URL prioritizing profile data and falling back to metadata
  const avatarUrl =
    profileData?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;
  const hasCustomAvatar = Boolean(avatarUrl);

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
  const navigateToEditProfile = () => router.push("/profile/EditProfile");

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
    if (attendanceStatus.isAlpha || attendanceStatus.todayStatus === "alpha") {
      return {
        color: "bg-red-600",
        text: "Alpha",
        textColor: "text-white",
      };
    }

    if (attendanceStatus.todayStatus === "present") {
      return attendanceStatus.isLate
        ? {
            color: "bg-yellow-600",
            text: "Terlambat",
            textColor: "text-white",
          }
        : {
            color: "bg-green-500",
            text: "Hadir",
            textColor: "text-white",
          };
    }

    if (attendanceStatus.isLate) {
      return {
        color: "bg-orange-500",
        text: "Terlambat",
        textColor: "text-white",
      };
    }

    switch (attendanceStatus.todayStatus) {
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
  const statusNoteColor = attendanceStatus.isAlpha
    ? "text-red-600 dark:text-red-400"
    : attendanceStatus.isLate
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-muted-foreground";
  const actionDisabled =
    !validationStatus.canCheckIn || refreshing || attendanceStatus.isAlpha;
  const primaryActionLabel = attendanceStatus.isAlpha
    ? "Alpha - Tidak Dapat Absen"
    : validationStatus.actionType === "present"
      ? "Absen Masuk"
      : validationStatus.actionType === "home"
        ? "Absen Pulang"
        : "Cek Status Absen";
  const secondaryActionMessage = attendanceStatus.isAlpha
    ? "Anda sudah dinyatakan alpha untuk hari ini."
    : attendanceStatus.isLate && attendanceStatus.statusNote
      ? attendanceStatus.statusNote
      : validationStatus.message;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false, // Disable swipe back on iOS
        }}
      />
      {/* Apply dynamic background based on theme */}
      <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
        {/* Main container with theme-based background */}
        <ScrollView
          className="flex-1 bg-background"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* --- Header Section --- */}
          <View className="px-6 pt-4 pb-6 bg-background">
            <View className="flex-row items-center justify-between mb-4">
              <TouchableOpacity
                className="flex-row items-center flex-1"
                onPress={navigateToEditProfile}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {hasCustomAvatar ? (
                  <Avatar
                    size="md"
                    fallback={displayName.charAt(0).toUpperCase() || "?"}
                    className="mr-3"
                    source={avatarUrl ?? undefined}
                  />
                ) : (
                  <View className="mr-3">
                    <View className="w-12 h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-border items-center justify-center">
                      <Icon
                        as={UserRound}
                        className="size-6 text-blue-500 dark:text-blue-400"
                      />
                    </View>
                  </View>
                )}
                <View className="flex-1">
                  <Text variant="large" className="text-foreground">
                    {displayName}
                  </Text>
                  <Text variant="muted" className="text-muted-foreground">
                    {format(currentTime, "EEEE, dd MMM yyyy", { locale: id })}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Waktu Sekarang - In header row */}
              <View className="flex-row items-center mr-3">
                <View
                  className={`px-3 py-2 rounded-lg ${
                    syncStatus === "synced"
                      ? "bg-gray-200 dark:bg-gray-800"
                      : syncStatus === "syncing"
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : "bg-yellow-100 dark:bg-yellow-900/30"
                  }`}
                >
                  <View className="flex-row items-center">
                    {syncStatus === "synced" ? (
                      <Icon as={Wifi} className="size-4 text-green-600" />
                    ) : syncStatus === "syncing" ? (
                      <Icon as={Clock} className="size-4 text-blue-600" />
                    ) : (
                      <Icon as={WifiOff} className="size-4 text-yellow-700" />
                    )}
                    <Text
                      variant="small"
                      className={`ml-1 font-medium ${
                        syncStatus === "synced"
                          ? "text-foreground"
                          : syncStatus === "syncing"
                            ? "text-blue-700 dark:text-blue-500"
                            : "text-yellow-700 dark:text-yellow-500"
                      }`}
                    >
                      Waktu{" "}
                      {driftDetected && (
                        <Text variant="small" className="text-red-600">
                          (drift)
                        </Text>
                      )}
                    </Text>
                  </View>
                  <Text
                    variant="default"
                    className="font-bold text-center mt-1 text-foreground"
                  >
                    {format(currentTime, "HH:mm:ss", { locale: id })}
                  </Text>
                  {syncSource !== "local" && (
                    <Text
                      variant="small"
                      className="text-xs text-center text-muted-foreground"
                    >
                      {syncSource === "server" ? "Server" : "NTP"}
                    </Text>
                  )}
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  Sentry.showFeedbackWidget();
                }}
                className="p-2 rounded-full"
              >
                <Icon as={Bell} className="size-5 text-foreground" />
              </TouchableOpacity>
            </View>
          </View>

          {/* --- Today's Status Card --- */}
          <View className="px-6 mb-4">
            <Card className="p-4 bg-card border-border">
              <View className="flex-row items-center justify-between">
                <Text variant="h4" className="text-foreground">
                  Status Hari Ini
                </Text>
                <Badge
                  className={`${statusBadge.color} ${statusBadge.textColor}`}
                >
                  <Text variant="default">{statusBadge.text}</Text>
                </Badge>
              </View>

              {attendanceStatus.statusNote && (
                <Text
                  variant="small"
                  className={`mt-2 font-medium ${statusNoteColor}`}
                >
                  {attendanceStatus.statusNote}
                </Text>
              )}

              <View className="space-y-3">
                {/* Check In Status */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {attendanceStatus.hasCheckedIn ? (
                      <Icon
                        as={CheckCircle}
                        className="size-5 text-green-600"
                      />
                    ) : (
                      <Icon as={AlertCircle} className="size-5 text-red-600" />
                    )}
                    <Text variant="default" className="ml-2 text-foreground">
                      Absen Masuk
                    </Text>
                  </View>
                  <Text variant="muted" className="text-muted-foreground">
                    {attendanceStatus.checkInTime
                      ? format(new Date(attendanceStatus.checkInTime), "HH:mm")
                      : "Belum absen"}
                  </Text>
                </View>

                {/* Check Out Status */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    {attendanceStatus.hasCheckedOut ? (
                      <Icon
                        as={CheckCircle}
                        className="size-5 text-green-600"
                      />
                    ) : (
                      <Icon as={AlertCircle} className="size-5 text-red-600" />
                    )}
                    <Text variant="default" className="ml-2 text-foreground">
                      Absen Pulang
                    </Text>
                  </View>
                  <Text variant="muted" className="text-muted-foreground">
                    {attendanceStatus.checkOutTime
                      ? format(new Date(attendanceStatus.checkOutTime), "HH:mm")
                      : "Belum absen"}
                  </Text>
                </View>

                {/* Work Hours */}
                {attendanceStatus.totalWorkHours && (
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <Icon as={Clock} className="size-5 text-blue-500" />
                      <Text variant="default" className="ml-2 text-foreground">
                        Total Jam Di Sekolah
                      </Text>
                    </View>
                    <Text
                      variant="small"
                      className="font-medium text-foreground"
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
            <Text variant="h3" className="mb-4 text-foreground">
              Halo, {displayName || "User"}
            </Text>

            {/* Large Square Primary Action - Attendance (Centered) */}
            <View className="items-center mb-4">
              <TouchableOpacity
                onPress={navigateToCheckIn}
                className="w-48"
                activeOpacity={0.8}
                disabled={actionDisabled}
              >
                <Card
                  className={`aspect-square ${
                    actionDisabled
                      ? "bg-gray-400 dark:bg-gray-600"
                      : "bg-blue-600 dark:bg-blue-700"
                  }`}
                >
                  <View className="flex-1 items-center justify-center p-4">
                    <Icon as={UserCheck} className="size-8 text-white" />
                    <Text
                      variant="large"
                      className="text-white font-semibold mt-2 text-center"
                    >
                      {primaryActionLabel}
                    </Text>
                    <Text
                      variant="small"
                      className={`text-center mt-1 px-2 ${
                        actionDisabled
                          ? "text-gray-200 dark:text-gray-300"
                          : "text-blue-100"
                      }`}
                    >
                      {secondaryActionMessage}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            </View>

            {/* Secondary Actions Grid */}
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={navigateToHistory}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card className="py-3 px-4 bg-gray-100 dark:bg-gray-800">
                  <Icon as={History} className="size-6 text-blue-600" />
                  <Text
                    variant="default"
                    className="mt-1 font-medium text-foreground"
                  >
                    Riwayat
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToPerizinan}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card className="py-3 px-4 bg-gray-100 dark:bg-gray-800">
                  <Icon
                    as={ClipboardPenLine}
                    className="size-6 text-blue-600"
                  />
                  <Text
                    variant="default"
                    className="mt-1 font-medium text-foreground"
                  >
                    Perizinan
                  </Text>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToSettings}
                className="flex-1"
                activeOpacity={0.8}
              >
                <Card className="py-3 px-4 bg-gray-100 dark:bg-gray-800">
                  <Icon as={Settings} className="size-6 text-blue-600" />
                  <Text
                    variant="default"
                    className="mt-1 font-medium text-foreground"
                  >
                    Setelan
                  </Text>
                </Card>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* --- Footer Section --- */}
        <View className="items-center px-6 py-3 border-t border-border bg-background">
          <Text variant="small" className="font-bold text-foreground">
            v1.8.2-internaldev | Branch: develop
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
