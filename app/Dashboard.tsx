// app/Dashboard.tsx
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useCallback, useMemo } from "react";
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
import Constants from "expo-constants";

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
  checkInStatus?: "Hadir" | "Terlambat";
  totalWorkHours?: string;
  todayStatus: "present" | "absent" | "leave" | "pending";
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

interface AttendanceSchedule {
  mulai_masuk: string | null;
  selesai_masuk: string | null;
  mulai_pulang: string | null;
  selesai_pulang: string | null;
  kompensasi_waktu?: number | null;
}

const DAY_KEY_MAP = [
  "minggu",
  "senin",
  "selasa",
  "rabu",
  "kamis",
  "jumat",
  "sabtu",
] as const;

type DayKey = (typeof DAY_KEY_MAP)[number];

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
  });
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceSchedule, setAttendanceSchedule] =
    useState<AttendanceSchedule | null>(null);
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
      const today = formatDateWIB(timeSync.getSyncedTime());

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
      let checkInStatus: "Hadir" | "Terlambat" | undefined;
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
        const hasAlphaRecord = todayAttendance.some(
          (record) => record.status === "Alpha",
        );

        if (hasAlphaRecord) {
          todayStatus = "absent";
        } else {
          const checkInRecord = todayAttendance.find(
            (record) =>
              record.status === "Hadir" || record.status === "Terlambat",
          );
          const checkOutRecord = todayAttendance.find(
            (record) => record.status === "Pulang",
          );

          if (checkInRecord) {
            hasCheckedIn = true;
            checkInTime = checkInRecord.created_at;
            checkInStatus = checkInRecord.status as "Hadir" | "Terlambat";
          }

          if (checkOutRecord) {
            hasCheckedOut = true;
            checkOutTime = checkOutRecord.created_at;
          }

          if (hasCheckedIn) {
            todayStatus = "present";
          }
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
        checkInStatus,
        totalWorkHours,
        todayStatus,
      });
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    }
  }, [user]);

  // Check live validation status using RPC
  const checkLiveValidationStatus = useCallback(async () => {
    if (!user?.id || attendanceStatus.hasCheckedOut) {
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: attendanceStatus.hasCheckedOut
          ? "Absensi hari ini sudah lengkap."
          : "User tidak ditemukan",
      });
      return;
    }

    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        status = (await Location.requestForegroundPermissionsAsync()).status;
        if (status !== "granted") {
          setValidationStatus({
            canCheckIn: false,
            actionType: "none",
            message: "Izin lokasi ditolak.",
          });
          return;
        }
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!location) {
        setValidationStatus({
          canCheckIn: false,
          actionType: "none",
          message: "Gagal mendapatkan lokasi GPS.",
        });
        return;
      }

      const { data, error } = await supabase.rpc("check_absensi_status", {
        p_user_id: user.id,
        p_user_lat: location.coords.latitude,
        p_user_lon: location.coords.longitude,
      });

      if (error) {
        throw error;
      }

      const result = data as AbsensiCheckResult;

      setValidationStatus({
        canCheckIn: result.status_code === "VALID",
        actionType: result.required_action,
        message: result.message,
      });
    } catch (error) {
      console.error("Error during live validation:", error);
      setValidationStatus({
        canCheckIn: false,
        actionType: "none",
        message: "Gagal memeriksa status absensi.",
      });
    }
  }, [user, attendanceStatus.hasCheckedOut]);

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

  const fetchAttendanceSchedule = useCallback(async (dayKey: DayKey) => {
    try {
      const { data, error } = await supabase
        .from("jadwal_absensi")
        .select(
          "mulai_masuk, selesai_masuk, mulai_pulang, selesai_pulang, kompensasi_waktu",
        )
        .eq("hari", dayKey)
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        if (error.code !== "PGRST116") {
          console.error(
            "Dashboard: Error fetching attendance schedule:",
            error.message,
          );
        }
        setAttendanceSchedule(null);
        return;
      }

      if (data) {
        setAttendanceSchedule(data as AttendanceSchedule);
      } else {
        setAttendanceSchedule(null);
      }
    } catch (scheduleError: any) {
      console.error(
        "Dashboard: Exception during attendance schedule fetch:",
        scheduleError.message,
      );
      setAttendanceSchedule(null);
    }
  }, []);

  const currentDayKey = useMemo<DayKey>(() => {
    const dayKey = DAY_KEY_MAP[currentTime.getDay()];
    return dayKey ?? "senin";
  }, [currentTime]);

  useEffect(() => {
    fetchAttendanceSchedule(currentDayKey);
  }, [currentDayKey, fetchAttendanceSchedule]);

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
      fetchAttendanceSchedule(currentDayKey),
    ]);
    setRefreshing(false);
  }, [
    fetchProfileData,
    fetchAttendanceData,
    checkLiveValidationStatus,
    fetchAttendanceSchedule,
    currentDayKey,
  ]);

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
    switch (attendanceStatus.todayStatus) {
      case "present":
        if (attendanceStatus.checkInStatus === "Terlambat") {
          return {
            color: "bg-orange-500",
            text: "Terlambat",
            textColor: "text-white",
          };
        }
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

  const derivedActionType =
    attendanceStatus.hasCheckedIn && !attendanceStatus.hasCheckedOut
      ? "home"
      : validationStatus.actionType;

  const normalizeTimeString = (
    value: string | null | undefined,
  ): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length >= 5) {
      const [hours, minutes] = trimmed.split(":");
      if (typeof hours === "string" && typeof minutes === "string") {
        return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
      }
    }
    return trimmed;
  };

  const getDateForToday = useCallback(
    (time: string | null | undefined): Date | null => {
      const normalized = normalizeTimeString(time);
      if (!normalized) return null;

      const [hours, minutes] = normalized
        .split(":")
        .map((part) => parseInt(part || "0", 10));

      if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
      }

      const base = new Date(currentTime);
      base.setHours(hours, minutes, 0, 0);
      return base;
    },
    [currentTime],
  );

  const presentScheduleText = useMemo(() => {
    if (!attendanceSchedule) return null;

    const start = normalizeTimeString(attendanceSchedule.mulai_masuk);
    if (!start) return null;

    const end = normalizeTimeString(attendanceSchedule.selesai_masuk);
    const windowText = end ? `${start} - ${end}` : start;

    let result = `Waktu absen masuk: ${windowText}`;
    if (attendanceSchedule.kompensasi_waktu) {
      result += ` (kompensasi +${attendanceSchedule.kompensasi_waktu} menit).`;
    } else {
      result += ".";
    }

    return result;
  }, [attendanceSchedule]);

  const pulangScheduleText = useMemo(() => {
    if (!attendanceSchedule) return null;

    const start = normalizeTimeString(attendanceSchedule.mulai_pulang);
    if (!start) return null;

    const end = normalizeTimeString(attendanceSchedule.selesai_pulang);
    const windowText = end ? `${start} - ${end}` : start;

    return `Waktu absen pulang: ${windowText} WIB.`;
  }, [attendanceSchedule]);

  const presentScheduleWindow = useMemo(() => {
    if (!attendanceSchedule) return null;

    const start = getDateForToday(attendanceSchedule.mulai_masuk);
    if (!start) return null;

    const end = getDateForToday(attendanceSchedule.selesai_masuk);

    return { start, end } as const;
  }, [attendanceSchedule, getDateForToday]);

  const pulangScheduleWindow = useMemo(() => {
    if (!attendanceSchedule) return null;

    const start = getDateForToday(attendanceSchedule.mulai_pulang);
    if (!start) return null;

    const end = getDateForToday(attendanceSchedule.selesai_pulang);

    return { start, end } as const;
  }, [attendanceSchedule, getDateForToday]);

  const isWithinPresentWindow = useMemo(() => {
    if (!presentScheduleWindow) return true;

    if (currentTime < presentScheduleWindow.start) {
      return false;
    }

    if (presentScheduleWindow.end && currentTime > presentScheduleWindow.end) {
      return false;
    }

    return true;
  }, [currentTime, presentScheduleWindow]);

  const isWithinPulangWindow = useMemo(() => {
    if (!pulangScheduleWindow) return true;

    if (currentTime < pulangScheduleWindow.start) {
      return false;
    }

    if (pulangScheduleWindow.end && currentTime > pulangScheduleWindow.end) {
      return false;
    }

    return true;
  }, [currentTime, pulangScheduleWindow]);

  const primaryActionMessage = useMemo(() => {
    if (derivedActionType === "home") {
      if (pulangScheduleText) {
        return pulangScheduleText;
      }

      return validationStatus.message;
    }

    if (derivedActionType === "present") {
      if (presentScheduleText) {
        return presentScheduleText;
      }

      return validationStatus.message;
    }

    return validationStatus.message;
  }, [
    derivedActionType,
    presentScheduleText,
    pulangScheduleText,
    validationStatus.message,
  ]);

  const scheduleAllowsAction = useMemo(() => {
    if (derivedActionType === "home") {
      return isWithinPulangWindow;
    }

    if (derivedActionType === "present") {
      return isWithinPresentWindow;
    }

    return true;
  }, [derivedActionType, isWithinPulangWindow, isWithinPresentWindow]);

  const isPrimaryActionDisabled =
    refreshing || !validationStatus.canCheckIn || !scheduleAllowsAction;

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
                disabled={isPrimaryActionDisabled}
              >
                <Card
                  className={`aspect-square ${
                    isPrimaryActionDisabled
                      ? "bg-gray-400 dark:bg-gray-600"
                      : "bg-blue-600 dark:bg-blue-700"
                  }`}
                >
                  <View className="flex-1 items-center justify-center p-4">
                    <Icon as={UserCheck} className="size-8 text-white" />
                    <Text
                      variant="small"
                      className={`mt-3 px-3 text-center text-xs leading-snug ${
                        isPrimaryActionDisabled
                          ? "text-gray-200 dark:text-gray-300"
                          : "text-white/90"
                      }`}
                    >
                      {primaryActionMessage}
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
            {Constants.expoConfig?.version}
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
