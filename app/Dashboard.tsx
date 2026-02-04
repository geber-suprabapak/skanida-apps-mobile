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
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";

import * as Sentry from "@sentry/react-native";

// Import your reusable shadcn/ui components
import { Avatar } from "~/components/ui/avatar";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
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
  Bug,
  History,
  ClipboardPenLine,
  Settings,
  UserRound,
  WifiOff,
  Wifi,
  Calendar,
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
  const insets = useSafeAreaInsets();
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
    attendanceType: "check_in" | "check_out";
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
        attendanceType: params.attendanceType as "check_in" | "check_out",
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
  const navigateToEditProfile = () => router.push("/profile/ManageAccount");

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

  // Animated pulse for the main action button
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    if (!isPrimaryActionDisabled) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isPrimaryActionDisabled, pulseAnim]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <StatusBar style="light" />
      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1 bg-background"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          {/* === HEADER SECTION - Edge-to-Edge Modern Style === */}
          <View className="relative overflow-hidden">
            {/* Gradient Background Header - Matching tweakcn primary */}
            <LinearGradient
              colors={["#3b82f6", "#2563eb", "#1d4ed8"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="px-6 pb-10"
              style={{ paddingTop: insets.top + 16 }}
            >
              {/* Top Bar - Avatar, Date & Bug Report */}
              <View className="flex-row items-center justify-between mb-6">
                <TouchableOpacity
                  className="flex-row items-center flex-1"
                  onPress={navigateToEditProfile}
                  activeOpacity={0.85}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {hasCustomAvatar ? (
                    <View className="relative">
                      <Avatar
                        size="md"
                        fallback={displayName.charAt(0).toUpperCase() || "?"}
                        className="border-2 border-white/40 shadow-sm"
                        source={avatarUrl ?? undefined}
                      />
                      <View className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                    </View>
                  ) : (
                    <View className="relative">
                      <View className="w-14 h-14 rounded-full bg-white/15 border border-white/30 items-center justify-center">
                        <Icon as={UserRound} className="size-7 text-white" />
                      </View>
                      <View className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
                    </View>
                  )}
                  <View className="ml-4 flex-1">
                    <Text className="text-white text-xl font-bold tracking-tight">
                      {displayName}
                    </Text>
                  </View>

                </TouchableOpacity>

                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={navigateToSettings}
                    className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/20"
                  >
                    <Icon as={Settings} className="size-5 text-white" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Sentry.showFeedbackWidget()}
                    className="w-10 h-10 rounded-full bg-white/15 items-center justify-center border border-white/20"
                  >
                    <Icon as={Bug} className="size-5 text-white" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Live Time Display - Clean Modern Card */}
              <View className="bg-white/10 rounded-3xl p-5 border border-white/15 backdrop-blur-sm">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <View className="w-14 h-14 rounded-2xl bg-white/15 items-center justify-center">
                      <Icon as={Clock} className="size-7 text-white" />
                    </View>
                    <View className="ml-4">
                      <View className="flex-row items-center mb-1">
                        {syncStatus === "synced" ? (
                          <Icon as={Wifi} className="size-3 text-emerald-300" />
                        ) : syncStatus === "syncing" ? (
                          <Icon as={Clock} className="size-3 text-amber-300" />
                        ) : (
                          <Icon as={WifiOff} className="size-3 text-red-300" />
                        )}
                        <Text className="text-white/70 text-xs ml-1.5 font-medium">
                          {syncStatus === "synced"
                            ? syncSource === "server"
                              ? "Server"
                              : syncSource === "ntp"
                                ? "NTP"
                                : "Lokal"
                            : syncStatus === "syncing"
                              ? "Menyinkronkan..."
                              : "Offline"}
                          {driftDetected && " • Drift"}
                        </Text>
                      </View>
                      <Text className="text-white text-4xl font-bold tracking-tight">
                        {format(currentTime, "HH:mm:ss", { locale: id })}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center bg-white/15 rounded-full px-3 py-1.5">
                      <Icon as={Calendar} className="size-3.5 text-white/90" />
                      <Text className="text-white text-xs ml-1.5 font-semibold">
                        {format(currentTime, "EEEE", { locale: id })}
                      </Text>
                    </View>
                    <Text className="text-white/80 text-sm mt-2 font-medium">
                      {format(currentTime, "dd MMMM yyyy", { locale: id })}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Curved Bottom Effect */}
            <View className="absolute -bottom-4 left-0 right-0 h-8 bg-background rounded-t-[32px]" />
          </View>

          {/* === TODAY'S STATUS SECTION - MODERN MINIMAL DESIGN === */}
          <View className="px-6 -mt-4">
            <Card className="p-0 overflow-hidden bg-card border border-border/50 shadow-sm rounded-3xl">
              {/* Two Column Time Display */}
              <View className="flex-row">
                {/* MASUK Column */}
                <View className="flex-1 items-center py-7 px-4">
                  <Text className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-3">
                    MASUK
                  </Text>
                  <Text className="text-foreground font-bold text-4xl tracking-tight">
                    {attendanceStatus.checkInTime
                      ? format(new Date(attendanceStatus.checkInTime), "HH:mm")
                      : "--:--"}
                  </Text>
                  {attendanceStatus.hasCheckedIn && (
                    <View className="mt-3 flex-row items-center bg-secondary/50 px-3 py-1 rounded-full">
                      <View
                        className={`w-2 h-2 rounded-full mr-1.5 ${
                          attendanceStatus.checkInStatus === "Terlambat"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <Text
                        className={`text-xs font-semibold ${
                          attendanceStatus.checkInStatus === "Terlambat"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {attendanceStatus.checkInStatus}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Vertical Divider */}
                <View className="w-px bg-border/50 self-stretch my-5" />

                {/* PULANG Column */}
                <View className="flex-1 items-center py-7 px-4">
                  <Text className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-3">
                    PULANG
                  </Text>
                  <Text className="text-foreground font-bold text-4xl tracking-tight">
                    {attendanceStatus.checkOutTime
                      ? format(new Date(attendanceStatus.checkOutTime), "HH:mm")
                      : "--:--"}
                  </Text>
                  {attendanceStatus.hasCheckedOut ? (
                    <View className="mt-3 flex-row items-center bg-secondary/50 px-3 py-1 rounded-full">
                      <View className="w-2 h-2 rounded-full mr-1.5 bg-blue-500" />
                      <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        Selesai
                      </Text>
                    </View>
                  ) : attendanceStatus.hasCheckedIn && attendanceSchedule?.mulai_pulang ? (
                    <View className="mt-3 items-center">
                      <Text className="text-xs text-muted-foreground">
                        Jadwal: {attendanceSchedule.mulai_pulang?.slice(0, 5)}
                        {attendanceSchedule.selesai_pulang ? ` - ${attendanceSchedule.selesai_pulang.slice(0, 5)}` : ""}
                      </Text>
                    </View>
                  ) : null}
                </View>

              </View>

              {/* Horizontal Divider */}
              <View className="h-px bg-border/50 mx-5" />

              {/* PRESENSI Button */}
              <View className="p-5">
                <TouchableOpacity
                  onPress={navigateToCheckIn}
                  disabled={isPrimaryActionDisabled}
                  activeOpacity={0.9}
                  className="overflow-hidden rounded-2xl"
                >
                  {isPrimaryActionDisabled ? (
                    <View className="py-5 items-center justify-center bg-secondary rounded-2xl border border-border/50">
                      <Text className="font-bold text-secondary-foreground text-base uppercase tracking-wider">
                        {attendanceStatus.hasCheckedOut
                          ? "SELESAI"
                          : refreshing
                            ? "MEMUAT..."
                            : "PRESENSI"}
                      </Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={
                        derivedActionType === "home"
                          ? ["#f59e0b", "#d97706", "#b45309"]
                          : ["#3b82f6", "#2563eb", "#1d4ed8"]
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="py-5 items-center justify-center rounded-2xl shadow-sm"
                    >
                      <Text className="font-bold text-white text-base uppercase tracking-wider">
                        {derivedActionType === "home"
                          ? "PRESENSI PULANG"
                          : "PRESENSI MASUK"}
                      </Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                {/* Total Hours (if both checked) */}
                {attendanceStatus.totalWorkHours && (
                  <View className="mt-3 items-center">
                    <Text className="text-muted-foreground text-xs">
                      Total waktu kerja:{" "}
                      <Text className="font-bold text-foreground">
                        {attendanceStatus.totalWorkHours}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </View>

          {/* === VERSION INFO === */}
          <View className="items-center mt-8 px-6 mb-40">
            <View className="flex-row items-center bg-secondary px-4 py-2 rounded-full border border-border/30">
              <Text
                variant="small"
                className="text-secondary-foreground font-medium"
              >
                Skanida v{Constants.expoConfig?.version}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* === PREMIUM FLOATING DOCK === */}
        <View className="absolute bottom-6 left-4 right-4">
          <LinearGradient
            colors={["#3b82f6", "#2563eb", "#1d4ed8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-[28px] shadow-2xl overflow-hidden"
          >
            {/* Dock Content */}
            <View className="flex-row items-center justify-around py-5 px-6">
              {/* Riwayat Button */}
              <TouchableOpacity
                onPress={navigateToHistory}
                activeOpacity={0.7}
                className="items-center flex-1"
              >
                <View className="w-14 h-14 rounded-2xl bg-white/15 items-center justify-center mb-2 border border-white/20">
                  <Icon as={History} className="size-6 text-white" />
                </View>
                <Text className="text-xs font-semibold text-white tracking-wide">
                  Riwayat
                </Text>
                <Text className="text-[10px] text-white/70 mt-0.5">
                  Lihat absensi
                </Text>
              </TouchableOpacity>

              {/* Center Divider */}
              <View className="w-px h-16 bg-white/20 mx-4" />

              {/* Perizinan Button */}
              <TouchableOpacity
                onPress={navigateToPerizinan}
                activeOpacity={0.7}
                className="items-center flex-1"
              >
                <View className="w-14 h-14 rounded-2xl bg-white/15 items-center justify-center mb-2 border border-white/20">
                  <Icon as={ClipboardPenLine} className="size-6 text-white" />
                </View>
                <Text className="text-xs font-semibold text-white tracking-wide">
                  Perizinan
                </Text>
                <Text className="text-[10px] text-white/70 mt-0.5">
                  Ajukan izin
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>

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
