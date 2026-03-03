import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Alert,
  RefreshControl,
  Image,
  AppState,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";

import { Avatar } from "~/components/ui/avatar";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";
import { getAvatarSignedUrl } from "~/utils/avatar";
import {
  Bug,
  History,
  ClipboardPenLine,
  Settings,
  UserRound,
} from "lucide-react-native";
import Constants from "expo-constants";
import LogoImage from "~/assets/skanidatransparan.png";

// Types
interface UserProfile {
  id: string;
  full_name?: string;
  avatar_url?: string;
}

interface AttendanceStatus {
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  checkInStatus?: "Hadir" | "Terlambat";
  totalWorkHours?: string;
  todayStatus: "present" | "absent" | "leave" | "pending";
}

interface AttendanceSchedule {
  mulai_masuk: string | null;
  selesai_masuk: string | null;
  mulai_pulang: string | null;
  selesai_pulang: string | null;
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

const isValidRemoteImageUrl = (url: string | null | undefined): boolean =>
  !!url && /^https?:\/\//.test(url);

const calculateWorkHours = (checkIn: string, checkOut: string): string => {
  try {
    const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    return `${hours}j ${minutes}m`;
  } catch {
    return "0j 0m";
  }
};

// Isolated clock — only this re-renders every second
const DashboardClock = React.memo(function DashboardClock() {
  const [time, setTime] = useState(timeSync.getSyncedTime());

  useEffect(() => {
    const id = setInterval(() => setTime(timeSync.getSyncedTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <Text className="text-blue-100 text-xs font-medium mb-1">
        {format(time, "EEEE, dd MMMM yyyy", { locale: id })}
      </Text>
      <Text className="text-white text-4xl font-bold tracking-tighter leading-tight">
        {format(time, "HH:mm:ss")}
      </Text>
    </>
  );
});

export default function Dashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);

  // State
  const [scheduleTime, setScheduleTime] = useState(timeSync.getSyncedTime());
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    hasCheckedIn: false,
    hasCheckedOut: false,
    todayStatus: "pending",
  });
  const [attendanceSchedule, setAttendanceSchedule] =
    useState<AttendanceSchedule | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 60-second interval for schedule computations
  useEffect(() => {
    const t = setInterval(
      () => setScheduleTime(timeSync.getSyncedTime()),
      60000,
    );
    return () => clearInterval(t);
  }, []);

  // Avatar pipeline
  const rawAvatarValue =
    profileData?.avatar_url ?? user?.user_metadata?.avatar_url ?? null;

  useEffect(() => {
    let active = true;
    if (!rawAvatarValue || typeof rawAvatarValue !== "string") {
      setAvatarUrl(null);
      return;
    }
    getAvatarSignedUrl(rawAvatarValue)
      .then((url) => {
        if (active && isValidRemoteImageUrl(url)) setAvatarUrl(url!.trim());
        else if (active) setAvatarUrl(null);
      })
      .catch(() => {
        if (active) setAvatarUrl(null);
      });
    return () => {
      active = false;
    };
  }, [rawAvatarValue]);

  // Data fetching
  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      if (data) setProfileData(data as UserProfile);
    } catch (error) {
      Sentry.captureException(error);
      setProfileData(null);
    }
  }, [user]);

  const fetchAttendanceData = useCallback(async () => {
    if (!user) return;
    try {
      const today = formatDateWIB(timeSync.getSyncedTime());

      const { data: todayAttendance } = await supabase
        .from("absences")
        .select("status, created_at")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: true });

      const { data: leaveRequests } = await supabase
        .from("perizinan")
        .select("approval_status, kategori_izin")
        .eq("user_id", user.id)
        .gte("tanggal", `${today}T00:00:00.000Z`)
        .lt("tanggal", `${today}T23:59:59.999Z`);

      let hasCheckedIn = false;
      let hasCheckedOut = false;
      let checkInTime = "";
      let checkOutTime = "";
      let checkInStatus: "Hadir" | "Terlambat" | undefined;
      let todayStatus: AttendanceStatus["todayStatus"] = "pending";

      if (leaveRequests && leaveRequests.length > 0) {
        todayStatus = "leave";
      } else if (todayAttendance && todayAttendance.length > 0) {
        if (todayAttendance.some((r) => r.status === "Alpha")) {
          todayStatus = "absent";
        } else {
          const inRec = todayAttendance.find(
            (r) => r.status === "Hadir" || r.status === "Terlambat",
          );
          const outRec = todayAttendance.find((r) => r.status === "Pulang");
          if (inRec) {
            hasCheckedIn = true;
            checkInTime = inRec.created_at;
            checkInStatus = inRec.status as "Hadir" | "Terlambat";
            todayStatus = "present";
          }
          if (outRec) {
            hasCheckedOut = true;
            checkOutTime = outRec.created_at;
          }
        }
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
      Sentry.captureException(error);
    }
  }, [user]);

  const fetchAttendanceSchedule = useCallback(async () => {
    try {
      const dayKey = DAY_KEY_MAP[new Date().getDay()];
      const { data, error } = await supabase
        .from("jadwal_absensi")
        .select("mulai_masuk, selesai_masuk, mulai_pulang, selesai_pulang")
        .eq("hari", dayKey)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      setAttendanceSchedule(data as AttendanceSchedule | null);
    } catch (error) {
      Sentry.captureException(error);
      setAttendanceSchedule(null);
    }
  }, []);

  // Lifecycle
  const initializeDashboard = useCallback(async () => {
    try {
      setIsInitializing(true);
      await Promise.all([
        fetchProfileData(),
        fetchAttendanceData(),
        fetchAttendanceSchedule(),
      ]);
    } finally {
      setIsInitializing(false);
    }
  }, [fetchProfileData, fetchAttendanceData, fetchAttendanceSchedule]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        timeSync.syncWithServer().then((ok) => {
          if (ok) setScheduleTime(timeSync.getSyncedTime());
        });
        fetchAttendanceData();
      }
    });
    return () => sub.remove();
  }, [fetchAttendanceData]);

  // Back button
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
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
      return true;
    });
    return () => handler.remove();
  }, []);

  // Refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchProfileData(),
      fetchAttendanceData(),
      timeSync.forceSyncWithServer().then((ok) => {
        if (ok) setScheduleTime(timeSync.getSyncedTime());
      }),
      fetchAttendanceSchedule(),
    ]);
    setRefreshing(false);
  }, [fetchProfileData, fetchAttendanceData, fetchAttendanceSchedule]);

  // Computed values
  const rawName =
    profileData?.full_name ??
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    "";
  const displayName = rawName
    ? rawName.split(" ").slice(0, 2).join(" ")
    : "Pengguna";
  const hasCustomAvatar = Boolean(avatarUrl);

  const greeting = useMemo(() => {
    const h = scheduleTime.getHours();
    if (h >= 3 && h < 11) return "Selamat Pagi";
    if (h >= 11 && h < 15) return "Selamat Siang";
    if (h >= 15 && h < 18) return "Selamat Sore";
    return "Selamat Malam";
  }, [scheduleTime]);

  const derivedActionType =
    attendanceStatus.hasCheckedIn && !attendanceStatus.hasCheckedOut
      ? "home"
      : "present";

  const { isPrimaryActionDisabled } = useMemo(() => {
    const parseTime = (t: string | null): Date | null => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      const d = new Date(scheduleTime);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const inWindow = (start: Date | null, end: Date | null) => {
      if (!start) return true;
      if (scheduleTime < start) return false;
      if (end && scheduleTime > end) return false;
      return true;
    };

    const presentOk = inWindow(
      parseTime(attendanceSchedule?.mulai_masuk ?? null),
      parseTime(attendanceSchedule?.selesai_masuk ?? null),
    );
    const pulangOk = inWindow(
      parseTime(attendanceSchedule?.mulai_pulang ?? null),
      parseTime(attendanceSchedule?.selesai_pulang ?? null),
    );

    const allows =
      derivedActionType === "home"
        ? pulangOk
        : derivedActionType === "present"
          ? presentOk
          : true;

    return {
      scheduleAllowsAction: allows,
      isPrimaryActionDisabled:
        refreshing ||
        isInitializing ||
        !allows ||
        attendanceStatus.hasCheckedOut,
    };
  }, [
    scheduleTime,
    attendanceSchedule,
    derivedActionType,
    refreshing,
    isInitializing,
    attendanceStatus.hasCheckedOut,
  ]);

  // Navigation
  const navigateToCheckIn = useCallback(
    () => router.push("/attendance/AbsenceReport"),
    [router],
  );
  const navigateToHistory = useCallback(
    () => router.push("/extra/riwayat"),
    [router],
  );
  const navigateToPerizinan = useCallback(
    () => router.push("/perizinan/status"),
    [router],
  );
  const navigateToSettings = useCallback(
    () => router.push("/extra/pengaturan"),
    [router],
  );
  const navigateToEditProfile = useCallback(
    () => router.push("/profile/ManageAccount"),
    [router],
  );

  // Render
  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 bg-background">
          <ScrollView
            className="flex-1 bg-background"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            {/* Header */}
            <View className="px-6 pt-2 pb-6" style={{ paddingTop: insets.top }}>
              <View className="flex-row items-center justify-between mb-8">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-lg border-2 border-white items-center justify-center bg-white">
                    <Image
                      source={LogoImage}
                      className="w-10 h-10"
                      resizeMode="contain"
                    />
                  </View>
                  <Text className="text-2xl font-bold text-stone-700 dark:text-white tracking-tight">
                    SKANIDA APPS
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={navigateToSettings}
                    className="w-10 h-10 rounded-full bg-secondary items-center justify-center border border-border/40"
                  >
                    <Icon as={Settings} className="size-5 text-foreground/70" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Sentry.showFeedbackWidget()}
                    className="w-10 h-10 rounded-full bg-secondary items-center justify-center border border-border/40"
                  >
                    <Icon as={Bug} className="size-5 text-foreground/70" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Greeting */}
              <Text className="text-stone-600 dark:text-white font-semibold text-base mb-3 ml-1">
                {greeting}, {rawName ? rawName.toUpperCase() : "PENGGUNA"}
              </Text>

              {/* Profile + Clock Hero Card */}
              <View className="p-5 flex-row items-center shadow-lg shadow-blue-900/20 bg-blue-600 rounded-[35px]">
                <TouchableOpacity
                  onPress={navigateToEditProfile}
                  activeOpacity={0.8}
                  className="mr-5 relative"
                >
                  {hasCustomAvatar ? (
                    <Avatar
                      size="lg"
                      fallback={displayName.charAt(0).toUpperCase() || "?"}
                      className="border-2 border-white/30 w-20 h-20"
                      source={avatarUrl ?? undefined}
                    />
                  ) : (
                    <View className="w-20 h-20 rounded-full bg-white/20 items-center justify-center border border-white/30">
                      <Icon as={UserRound} className="size-10 text-white" />
                    </View>
                  )}
                  <View className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-400 rounded-full border-[3px] border-blue-600" />
                </TouchableOpacity>
                <View className="flex-1 justify-center">
                  <DashboardClock />
                </View>
              </View>
            </View>

            {/* Attendance Status Card */}
            <View className="px-6 mt-4">
              <Card className="p-0 overflow-hidden bg-card border border-border/50 shadow-sm rounded-3xl">
                <View className="flex-row">
                  {/* Masuk Column */}
                  <View className="flex-1 items-center py-7 px-4">
                    <Text className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-3">
                      MASUK
                    </Text>
                    <Text className="text-foreground font-bold text-4xl tracking-tight">
                      {attendanceStatus.checkInTime
                        ? format(
                            new Date(attendanceStatus.checkInTime),
                            "HH:mm",
                          )
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

                  {/* Divider */}
                  <View className="w-px bg-border/50 self-stretch my-5" />

                  {/* Pulang Column */}
                  <View className="flex-1 items-center py-7 px-4">
                    <Text className="text-muted-foreground text-xs uppercase tracking-widest font-semibold mb-3">
                      PULANG
                    </Text>
                    <Text className="text-foreground font-bold text-4xl tracking-tight">
                      {attendanceStatus.checkOutTime
                        ? format(
                            new Date(attendanceStatus.checkOutTime),
                            "HH:mm",
                          )
                        : "--:--"}
                    </Text>
                    {attendanceStatus.hasCheckedOut ? (
                      <View className="mt-3 flex-row items-center bg-secondary/50 px-3 py-1 rounded-full">
                        <View className="w-2 h-2 rounded-full mr-1.5 bg-blue-500" />
                        <Text className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          Selesai
                        </Text>
                      </View>
                    ) : attendanceStatus.hasCheckedIn &&
                      attendanceSchedule?.mulai_pulang ? (
                      <View className="mt-3 items-center">
                        <Text className="text-xs text-muted-foreground">
                          Jadwal: {attendanceSchedule.mulai_pulang?.slice(0, 5)}
                          {attendanceSchedule.selesai_pulang
                            ? ` - ${attendanceSchedule.selesai_pulang.slice(0, 5)}`
                            : ""}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Divider */}
                <View className="h-px bg-border/50 mx-5" />

                {/* Action Button */}
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
                      <View
                        className={`py-5 items-center justify-center rounded-2xl shadow-sm ${
                          derivedActionType === "home"
                            ? "bg-amber-500"
                            : "bg-blue-600"
                        }`}
                      >
                        <Text className="font-bold text-white text-base uppercase tracking-wider">
                          {derivedActionType === "home"
                            ? "PRESENSI PULANG"
                            : "PRESENSI MASUK"}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

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

            {/* Navigation Buttons */}
            <View className="flex-row mx-6 mt-10 mb-10 gap-3">
              <TouchableOpacity
                onPress={navigateToHistory}
                activeOpacity={0.7}
                className="flex-1 bg-blue-600 flex-row items-center justify-center py-4 rounded-full shadow-md border border-white/10"
              >
                <View className="w-10 h-10 rounded-full bg-white/15 items-center justify-center mr-3 border border-white/20">
                  <Icon as={History} className="size-5 text-white" />
                </View>
                <Text className="text-base font-bold text-white tracking-wide">
                  Riwayat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToPerizinan}
                activeOpacity={0.7}
                className="flex-1 bg-blue-600 flex-row items-center justify-center py-4 rounded-full shadow-md border border-white/10"
              >
                <View className="w-10 h-10 rounded-full bg-white/15 items-center justify-center mr-3 border border-white/20">
                  <Icon as={ClipboardPenLine} className="size-5 text-white" />
                </View>
                <Text className="text-base font-bold text-white tracking-wide">
                  Perizinan
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Floating Version */}
          <View className="absolute bottom-6 left-0 right-0 items-center pointer-events-none">
            <View className="bg-secondary/90 px-4 py-1.5 rounded-full border border-border/30 shadow-sm">
              <Text
                variant="small"
                className="text-secondary-foreground font-medium text-xs"
              >
                Skanida v{Constants.expoConfig?.version}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
