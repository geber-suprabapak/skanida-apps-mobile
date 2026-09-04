import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Stack, useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Alert,
  RefreshControl,
  AppState,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import { StatusBar } from "expo-status-bar";
import * as Sentry from "@sentry/react-native";
import { useUniwind } from "uniwind";

import { Avatar } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import { Icon } from "~/components/ui/icon";
import AttendanceSuccessPopup from "~/components/ui/pop-up";
import useAuthStore from "~/store/authStore";
import { fetchEnrollmentStatus } from "~/utils/enrollment";
import type { EnrollmentStatus } from "~/utils/enrollment";
import {
  fetchFaceApiRuntimeStatus,
  type FaceApiRuntimeStatusResult,
} from "~/utils/faceApiRuntime";
import {
  consumePendingAttendanceSuccess,
  type PendingAttendanceSuccess,
} from "~/features/attendance-workflow";
import { toWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";
import { faceApiLog } from "~/utils/faceApiDebug";
import {
  getDashboard,
  toMobileAttendanceSchedule,
  toMobileAttendanceStatus,
  type BffDashboardPrimaryAction,
} from "~/utils/bffMobileApi";
import { BffRequestError } from "~/utils/bff";
import {
  AlertCircle,
  Bug,
  Clock,
  History,
  ClipboardPenLine,
  Loader2,
  LogOut,
  RefreshCw,
  Scan,
  Settings,
  UserRound,
} from "lucide-react-native";
import Constants from "expo-constants";
import LogoImage from "~/assets/skanidatransparan.png";

// Types
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
  kompensasi_waktu: number | null;
}

const parseScheduleTimeForWIBDate = (
  time: string | null,
  baseDate: Date,
): Date | null => {
  if (!time) return null;

  const timeParts = time.split(":");
  if (timeParts.length < 2 || timeParts.length > 3) return null;

  const [hoursRaw, minutesRaw, secondsRaw = "0"] = timeParts;
  const isIntegerToken = (value: string) => /^\d+$/.test(value);
  if (
    !isIntegerToken(hoursRaw) ||
    !isIntegerToken(minutesRaw) ||
    !isIntegerToken(secondsRaw)
  ) {
    return null;
  }

  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const seconds = Number(secondsRaw);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const wibDate = toWIB(baseDate);
  return new Date(
    Date.UTC(
      wibDate.getUTCFullYear(),
      wibDate.getUTCMonth(),
      wibDate.getUTCDate(),
      hours - 7,
      minutes,
      seconds,
      0,
    ),
  );
};

const addMinutesToDate = (
  date: Date | null,
  minutes: number | null | undefined,
): Date | null => {
  if (!date) return null;

  const normalizedMinutes =
    minutes !== null && minutes !== undefined && Number.isFinite(minutes)
      ? Math.max(0, Math.trunc(minutes))
      : 0;
  return new Date(date.getTime() + normalizedMinutes * 60 * 1000);
};

const isValidRemoteImageUrl = (url: string | null | undefined): boolean =>
  !!url && /^https?:\/\//.test(url);

const toRuntimeStatus = (
  status: "healthy" | "unhealthy",
  message?: string | null,
): FaceApiRuntimeStatusResult => {
  if (status === "healthy") {
    return {
      state: "healthy",
      title: "Server siap digunakan",
      message: "Layanan verifikasi siap digunakan.",
      issues: [],
    };
  }

  return {
    state: "unhealthy",
    title: "Server belum siap",
    message: "Server verifikasi sedang belum siap. Silakan coba lagi.",
    issues: message ? [message] : [],
    error: message ?? undefined,
  };
};

const toOfflineRuntimeStatus = (cause: unknown): FaceApiRuntimeStatusResult => {
  const message =
    cause instanceof Error
      ? cause.message
      : "Dashboard belum dapat dimuat dari server.";

  return {
    state: "offline",
    title: "Server tidak terhubung",
    message: "Server verifikasi tidak dapat dihubungi.",
    issues: [],
    error: message,
  };
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
      <Text
        maxFontSizeMultiplier={1.3}
        className="text-white text-4xl font-bold tracking-tighter leading-tight"
      >
        {format(time, "HH:mm:ss")}
      </Text>
    </>
  );
});

export default function Dashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const userProfile = useAuthStore((state) => state.userProfile);
  const { theme } = useUniwind();
  const isDark = theme === "dark";

  // State
  const [scheduleTime, setScheduleTime] = useState(timeSync.getSyncedTime());
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState("");
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    hasCheckedIn: false,
    hasCheckedOut: false,
    todayStatus: "pending",
  });
  const [attendanceSchedule, setAttendanceSchedule] =
    useState<AttendanceSchedule | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>("loading");
  const [enrollmentError, setEnrollmentError] = useState("");
  const [faceApiRuntime, setFaceApiRuntime] =
    useState<FaceApiRuntimeStatusResult | null>(null);
  const [isCheckingFaceApi, setIsCheckingFaceApi] = useState(true);
  const [primaryAction, setPrimaryAction] =
    useState<BffDashboardPrimaryAction | null>(null);
  const [attendanceSuccess, setAttendanceSuccess] =
    useState<PendingAttendanceSuccess | null>(null);
  const [isPendingApproval, setIsPendingApproval] = useState(false);

  // 60-second interval for schedule computations
  useEffect(() => {
    const t = setInterval(
      () => setScheduleTime(timeSync.getSyncedTime()),
      60000,
    );
    return () => clearInterval(t);
  }, []);

  // Data fetching
  const fetchAttendanceData = useCallback(async () => {
    if (!user) return;
    setIsCheckingFaceApi(true);
    try {
      const data = await getDashboard();
      if (data.profile.lifecycle_status === "pending") {
        setIsPendingApproval(true);
        return;
      }
      setIsPendingApproval(false);
      const avatar = data.profile.avatar_url;

      setAttendanceStatus(toMobileAttendanceStatus(data.attendance));
      setAttendanceSchedule(toMobileAttendanceSchedule(data.schedule));
      setAvatarUrl(isValidRemoteImageUrl(avatar) ? avatar!.trim() : null);
      setDashboardName(data.profile.full_name ?? "");
      setFaceApiRuntime(
        toRuntimeStatus(data.face.server_status, data.face.message),
      );
      setEnrollmentStatus(data.face.enrollment_status);
      setEnrollmentError(
        data.face.enrollment_status === "not_enrolled" ? data.face.message : "",
      );
      setPrimaryAction(data.primary_action);
    } catch (error) {
      if (
        (error instanceof BffRequestError &&
          (error.status === 403 || error.code === "FORBIDDEN")) ||
        (error instanceof Error &&
          /pending|menunggu|persetujuan|access denied|forbidden/i.test(
            error.message,
          ))
      ) {
        setIsPendingApproval(true);
        return;
      }
      Sentry.captureException(error);
      setFaceApiRuntime(toOfflineRuntimeStatus(error));
      setEnrollmentStatus("error");
      setEnrollmentError(
        error instanceof Error
          ? error.message
          : "Gagal memuat dashboard dari server.",
      );
      setPrimaryAction(null);
    } finally {
      setIsCheckingFaceApi(false);
    }
  }, [user]);

  const checkEnrollmentStatus = useCallback(async () => {
    faceApiLog("dashboard:enroll-status-check:start", {
      userId: user?.id ?? null,
      email: user?.email ?? null,
    });
    setEnrollmentStatus("loading");
    setEnrollmentError("");

    const result = await fetchEnrollmentStatus();
    faceApiLog("dashboard:enroll-status-check:result", {
      result,
      userId: user?.id ?? null,
    });

    setEnrollmentStatus(result.status);
    if (result.error) {
      setEnrollmentError(result.error);
    }
  }, [user?.email, user?.id]);

  const checkFaceApiRuntime = useCallback(async () => {
    setIsCheckingFaceApi(true);
    const result = await fetchFaceApiRuntimeStatus();
    faceApiLog("dashboard:runtime-check:result", {
      result,
      userId: user?.id ?? null,
    });
    setFaceApiRuntime(result);
    setIsCheckingFaceApi(false);
  }, [user?.id]);

  // Lifecycle
  const initializeDashboard = useCallback(async () => {
    try {
      setIsInitializing(true);
      await fetchAttendanceData();
    } finally {
      setIsInitializing(false);
    }
  }, [fetchAttendanceData]);

  useEffect(() => {
    initializeDashboard();
  }, [initializeDashboard]);

  // Refresh dashboard-owned readiness/enrollment/attendance whenever focus returns.
  useFocusEffect(
    useCallback(() => {
      const pendingSuccess = consumePendingAttendanceSuccess();
      if (pendingSuccess) {
        setAttendanceSuccess(pendingSuccess);
      }

      void fetchAttendanceData();
    }, [fetchAttendanceData]),
  );

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
      fetchAttendanceData(),
      timeSync.forceSyncWithServer().then((ok) => {
        if (ok) setScheduleTime(timeSync.getSyncedTime());
      }),
    ]);
    setRefreshing(false);
  }, [fetchAttendanceData]);

  // Computed values
  const rawName =
    dashboardName ||
    userProfile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "";
  const displayName = rawName
    ? rawName.split(" ").slice(0, 2).join(" ")
    : "Pengguna";
  const hasCustomAvatar = Boolean(avatarUrl);

  const greeting = useMemo(() => {
    const wibDate = toWIB(scheduleTime);
    const h = wibDate.getUTCHours();
    if (h >= 3 && h < 11) return "Selamat Pagi";
    if (h >= 11 && h < 15) return "Selamat Siang";
    if (h >= 15 && h < 18) return "Selamat Sore";
    return "Selamat Malam";
  }, [scheduleTime]);

  const derivedActionType =
    primaryAction?.type === "check_out"
      ? "home"
      : primaryAction?.type === "check_in"
        ? "present"
        : attendanceStatus.hasCheckedIn && !attendanceStatus.hasCheckedOut
          ? "home"
          : "present";

  const { isPrimaryActionDisabled } = useMemo(() => {
    const parseTime = (t: string | null): Date | null => {
      return parseScheduleTimeForWIBDate(t, scheduleTime);
    };

    const inWindow = (start: Date | null, end: Date | null) => {
      if (!start) return false;
      if (scheduleTime < start) return false;
      if (end && scheduleTime > end) return false;
      return true;
    };

    const checkInEnd = addMinutesToDate(
      parseTime(attendanceSchedule?.selesai_masuk ?? null),
      attendanceSchedule?.kompensasi_waktu,
    );

    const presentOk = inWindow(
      parseTime(attendanceSchedule?.mulai_masuk ?? null),
      checkInEnd,
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
    const serverAllowsAction = primaryAction?.allowed ?? allows;

    return {
      scheduleAllowsAction: allows,
      isPrimaryActionDisabled:
        refreshing ||
        isInitializing ||
        isCheckingFaceApi ||
        attendanceStatus.todayStatus === "leave" ||
        enrollmentStatus !== "enrolled" ||
        !serverAllowsAction ||
        faceApiRuntime?.state !== "healthy" ||
        attendanceStatus.hasCheckedOut,
    };
  }, [
    scheduleTime,
    attendanceSchedule,
    derivedActionType,
    refreshing,
    isInitializing,
    isCheckingFaceApi,
    enrollmentStatus,
    faceApiRuntime?.state,
    primaryAction?.allowed,
    attendanceStatus.hasCheckedOut,
    attendanceStatus.todayStatus,
  ]);

  const primaryActionLabel = useMemo(() => {
    if (attendanceStatus.hasCheckedOut) {
      return "SELESAI";
    }

    if (attendanceStatus.todayStatus === "leave") {
      return "SUDAH ADA IZIN";
    }

    if (refreshing) {
      return "MEMUAT...";
    }

    if (isCheckingFaceApi) {
      return "CEK SERVER...";
    }

    if (faceApiRuntime?.state !== "healthy") {
      return "SERVER BELUM SIAP";
    }

    if (enrollmentStatus === "loading") {
      return "CEK STATUS WAJAH...";
    }

    if (enrollmentStatus === "not_enrolled") {
      return "WAJAH BELUM TERDAFTAR";
    }

    if (enrollmentStatus === "error") {
      return "CEK STATUS WAJAH";
    }

    if (primaryAction && !primaryAction.allowed) {
      return primaryAction.label.toUpperCase();
    }

    return "PRESENSI";
  }, [
    attendanceStatus.hasCheckedOut,
    attendanceStatus.todayStatus,
    refreshing,
    isCheckingFaceApi,
    faceApiRuntime?.state,
    enrollmentStatus,
    primaryAction,
  ]);

  // Navigation
  const navigateToCheckIn = useCallback(() => {
    faceApiLog("dashboard:navigate-attendance", {
      enrollmentStatus,
      attendanceStatus,
      derivedActionType,
      isPrimaryActionDisabled,
    });
    router.push("/attendance/AbsenceReport");
  }, [
    router,
    enrollmentStatus,
    attendanceStatus,
    derivedActionType,
    isPrimaryActionDisabled,
  ]);
  const navigateToEnroll = useCallback(() => {
    faceApiLog("dashboard:navigate-enroll", {
      enrollmentStatus,
      enrollmentError,
      userId: user?.id ?? null,
    });
    router.push("/profile/enroll");
  }, [router, enrollmentStatus, enrollmentError, user?.id]);
  // SAFETY: These paths are supplied by the `(tabs)` route group; Metro refreshes
  // Expo Router's generated route cache after discovering the new route files.
  const navigateToHistory = useCallback(
    () => router.navigate("/riwayat" as Href),
    [router],
  );
  const navigateToPerizinan = useCallback(
    // SAFETY: `/perizinan` is supplied by `(tabs)/perizinan.tsx`.
    () => router.navigate("/perizinan" as Href),
    [router],
  );
  const navigateToSettings = useCallback(
    // SAFETY: `/pengaturan` is supplied by `(tabs)/pengaturan.tsx`.
    () => router.navigate("/pengaturan" as Href),
    [router],
  );
  const navigateToEditProfile = useCallback(
    () => router.push("/profile/ManageAccount"),
    [router],
  );

  // Render
  if (isPendingApproval) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
        <StatusBar style={isDark ? "light" : "dark"} />
        <SafeAreaView className="flex-1 bg-background">
          <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              alignItems: "center",
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            <View className="w-full max-w-sm items-center">
              <View className="w-24 h-24 rounded-full bg-amber-500/10 dark:bg-amber-500/20 items-center justify-center mb-6 border border-amber-500/30">
                <Icon as={Clock} className="size-12 text-amber-500" />
              </View>

              <Text
                variant="h2"
                className="text-2xl font-bold text-center mb-3 text-foreground"
              >
                Akun Menunggu Persetujuan
              </Text>

              <Text className="text-center text-sm text-muted-foreground leading-relaxed mb-6">
                Pendaftaran akun Anda sedang ditinjau oleh administrator
                sekolah. Silakan tunggu hingga akun diverifikasi dan disetujui
                untuk dapat mengakses layanan absensi.
              </Text>

              <Card className="w-full p-4 mb-6 bg-card border border-border/50 rounded-2xl">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  Status Akun
                </Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-bold text-foreground">
                    {displayName || "Siswa"}
                  </Text>
                  <View className="bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30">
                    <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Pending
                    </Text>
                  </View>
                </View>
              </Card>

              <View className="w-full gap-3">
                <Button
                  variant="default"
                  size="lg"
                  className="w-full bg-secondary active:bg-secondary/80"
                  onPress={onRefresh}
                  disabled={refreshing}
                >
                  <Icon
                    as={RefreshCw}
                    className="size-5 text-secondary-foreground mr-2"
                  />
                  <Text className="text-secondary-foreground font-semibold">
                    {refreshing
                      ? "Memeriksa Status..."
                      : "Cek Status Persetujuan"}
                  </Text>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-border"
                  onPress={async () => {
                    await useAuthStore.getState().logout();
                    router.replace("/auth/AuthSelector");
                  }}
                >
                  <Icon as={LogOut} className="size-5 text-foreground mr-2" />
                  <Text className="text-foreground font-semibold">
                    Keluar / Ganti Akun
                  </Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style={isDark ? "light" : "dark"} />
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 bg-background">
          <AttendanceSuccessPopup
            visible={Boolean(attendanceSuccess)}
            onClose={() => setAttendanceSuccess(null)}
            attendanceType={attendanceSuccess?.attendanceType ?? "check_in"}
            processingTime={attendanceSuccess?.processingTime}
          />

          <ScrollView
            className="flex-1 bg-background"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 32,
              width: "100%",
              maxWidth: 672,
              alignSelf: "center",
            }}
          >
            {/* Header */}
            <View className="px-6 pt-2 pb-6">
              <View className="flex-row items-center justify-between mb-8">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-lg border border-border items-center justify-center bg-card">
                    <Image
                      source={LogoImage}
                      className="w-10 h-10"
                      contentFit="contain"
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <Text className="text-2xl font-bold text-foreground tracking-tight">
                    SKANIDA APPS
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={navigateToSettings}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Pengaturan"
                    accessibilityHint="Ketuk dua kali untuk membuka pengaturan aplikasi"
                    className="w-12 h-12 rounded-full bg-secondary items-center justify-center border border-border/40"
                  >
                    <Icon as={Settings} className="size-5 text-foreground/70" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => Sentry.showFeedbackWidget()}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Laporkan Masalah"
                    accessibilityHint="Ketuk dua kali untuk mengirim umpan balik atau laporan kendala"
                    className="w-12 h-12 rounded-full bg-secondary items-center justify-center border border-border/40"
                  >
                    <Icon as={Bug} className="size-5 text-foreground/70" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Greeting */}
              <Text className="text-muted-foreground font-semibold text-base mb-3 ml-1">
                {greeting}, {rawName ? rawName.toUpperCase() : "PENGGUNA"}
              </Text>

              {/* Profile + Clock Hero Card */}
              <View className="p-5 flex-row items-center bg-slate-900 rounded-2xl">
                <TouchableOpacity
                  onPress={navigateToEditProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Profil Siswa"
                  accessibilityHint="Ketuk dua kali untuk mengelola profil dan foto"
                  activeOpacity={0.8}
                  className="mr-5 relative min-h-[48px] min-w-[48px]"
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
                  <View className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </TouchableOpacity>
                <View className="flex-1 justify-center">
                  <DashboardClock />
                </View>
              </View>
            </View>

            {!isCheckingFaceApi &&
              faceApiRuntime &&
              faceApiRuntime.state !== "healthy" && (
                <View className="px-6 mt-4">
                  <Card
                    className={`p-5 border rounded-2xl ${
                      faceApiRuntime.state === "unhealthy"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                    }`}
                  >
                    <View className="flex-row items-center mb-3">
                      <View
                        className={`w-10 h-10 rounded-full items-center justify-center ${
                          faceApiRuntime.state === "unhealthy"
                            ? "bg-amber-500/20"
                            : "bg-red-500/20"
                        }`}
                      >
                        <Icon
                          as={AlertCircle}
                          className={`size-6 ${
                            faceApiRuntime.state === "unhealthy"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-foreground font-bold text-base">
                          {faceApiRuntime.title}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {faceApiRuntime.message}
                        </Text>
                      </View>
                    </View>

                    <Button
                      variant="outline"
                      size="default"
                      onPress={checkFaceApiRuntime}
                      className="w-full border-border"
                    >
                      <Icon
                        as={Loader2}
                        className="size-5 text-foreground mr-2"
                      />
                      <Text className="text-foreground font-semibold">
                        Cek Status Server
                      </Text>
                    </Button>
                  </Card>
                </View>
              )}

            {faceApiRuntime?.state === "healthy" &&
              enrollmentStatus === "not_enrolled" && (
                <View className="px-6 mt-4">
                  <Card className="p-5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl">
                    <View className="flex-row items-center mb-3">
                      <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center">
                        <Icon
                          as={AlertCircle}
                          className="size-6 text-amber-600 dark:text-amber-400"
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-foreground font-bold text-base">
                          Wajah Belum Terdaftar
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          Daftarkan wajah terlebih dahulu sebelum melakukan
                          presensi.
                        </Text>
                      </View>
                    </View>
                    <Button
                      variant="default"
                      size="default"
                      onPress={navigateToEnroll}
                      className="w-full bg-amber-500 active:bg-amber-600"
                    >
                      <Icon as={Scan} className="size-5 text-white mr-2" />
                      <Text className="text-white font-semibold">
                        Daftarkan Wajah
                      </Text>
                    </Button>
                  </Card>
                </View>
              )}

            {faceApiRuntime?.state === "healthy" &&
              enrollmentStatus === "error" && (
                <View className="px-6 mt-4">
                  <Card className="p-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl">
                    <View className="flex-row items-center mb-3">
                      <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center">
                        <Icon
                          as={AlertCircle}
                          className="size-6 text-red-600 dark:text-red-400"
                        />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-foreground font-bold text-base">
                          Status Wajah Belum Terbaca
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {enrollmentError || "Silakan coba lagi."}
                        </Text>
                      </View>
                    </View>
                    <Button
                      variant="outline"
                      size="default"
                      onPress={checkEnrollmentStatus}
                      className="w-full border-border"
                    >
                      <Icon
                        as={Loader2}
                        className="size-5 text-foreground mr-2"
                      />
                      <Text className="text-foreground font-semibold">
                        Coba Lagi
                      </Text>
                    </Button>
                  </Card>
                </View>
              )}

            {/* Attendance Status Card */}
            <View className="px-6 mt-4">
              <Card className="p-0 overflow-hidden bg-card border border-border/50 rounded-2xl">
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
                        <View className="w-2 h-2 rounded-full mr-1.5 bg-primary" />
                        <Text className="text-xs font-semibold text-primary">
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
                    accessibilityRole="button"
                    accessibilityLabel={primaryActionLabel}
                    accessibilityHint="Ketuk dua kali untuk mencatat presensi"
                    accessibilityState={{ disabled: isPrimaryActionDisabled }}
                    activeOpacity={0.9}
                    className="overflow-hidden rounded-2xl min-h-[48px]"
                  >
                    {isPrimaryActionDisabled ? (
                      <View className="py-5 items-center justify-center bg-secondary rounded-2xl border border-border/50 min-h-[48px]">
                        <Text className="font-bold text-secondary-foreground text-base uppercase tracking-wider">
                          {primaryActionLabel}
                        </Text>
                      </View>
                    ) : (
                      <View
                        className={`py-5 items-center justify-center rounded-2xl min-h-[48px] ${
                          derivedActionType === "home"
                            ? "bg-amber-500"
                            : "bg-primary"
                        }`}
                      >
                        <Text className="font-bold text-white text-base uppercase tracking-wider">
                          {primaryAction?.allowed
                            ? primaryAction.label.toUpperCase()
                            : derivedActionType === "home"
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
                accessibilityRole="button"
                accessibilityLabel="Riwayat Presensi"
                accessibilityHint="Ketuk dua kali untuk melihat kalender riwayat presensi"
                activeOpacity={0.7}
                className="flex-1 bg-secondary flex-row items-center justify-center py-4 min-h-[48px] rounded-2xl border border-border"
              >
                <View className="w-10 h-10 rounded-full bg-background items-center justify-center mr-3 border border-border">
                  <Icon
                    as={History}
                    className="size-5 text-secondary-foreground"
                  />
                </View>
                <Text className="text-base font-bold text-secondary-foreground tracking-wide">
                  Riwayat
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={navigateToPerizinan}
                accessibilityRole="button"
                accessibilityLabel="Perizinan Siswa"
                accessibilityHint="Ketuk dua kali untuk membuka status dan pengajuan izin"
                activeOpacity={0.7}
                className="flex-1 bg-secondary flex-row items-center justify-center py-4 min-h-[48px] rounded-2xl border border-border"
              >
                <View className="w-10 h-10 rounded-full bg-background items-center justify-center mr-3 border border-border">
                  <Icon
                    as={ClipboardPenLine}
                    className="size-5 text-secondary-foreground"
                  />
                </View>
                <Text className="text-base font-bold text-secondary-foreground tracking-wide">
                  Perizinan
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Floating Version */}
          <View className="absolute bottom-6 left-0 right-0 items-center pointer-events-none">
            <View className="bg-secondary/90 px-4 py-1.5 rounded-full border border-border/30">
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
