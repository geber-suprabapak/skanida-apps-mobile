import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, TouchableOpacity, BackHandler } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import {
  cancelUpayaPresensi,
  prepareUpayaPresensi,
  type PrepareOutcome,
} from "~/features/upaya-presensi";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import useAuthStore from "~/store/authStore";
import type { MobileAttendanceAction } from "~/utils/bffMobileApi";
import {
  elapsedMs,
  faceApiError,
  faceApiLog,
  faceApiWarn,
  startFaceApiTimer,
} from "~/utils/faceApiDebug";

import {
  ChevronLeft,
  Loader2,
  MapPin,
  MapPinOff,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react-native";

type AttendanceActionResponse = MobileAttendanceAction;

export default function AbsenceReport() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  // Hanya butuh beberapa state sederhana
  const [status, setStatus] = useState<AttendanceActionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (isLoading) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false,
      );
    } else {
      rotation.value = 0;
    }
  }, [isLoading, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // Navigasi ke halaman kamera
  const navigateToCamera = useCallback(
    (statusData: AttendanceActionResponse, attemptId: string) => {
      if (!isMountedRef.current) {
        faceApiWarn("attendance-report:navigate-camera:blocked-unmounted", {
          statusData,
          attemptId,
        });
        return;
      }

      faceApiLog("attendance-report:navigate-camera", {
        statusData,
        attemptId,
      });

      router.push({
        pathname: "/attendance/CameraAttendance",
        params: { attemptId },
      });
    },
    [router],
  );

  const fetchAttendanceStatus = useCallback(async () => {
    if (!user) {
      faceApiWarn("attendance-report:status:missing-user", {});
      setErrorMessage("Sesi pengguna tidak valid, silakan login ulang.");
      setIsLoading(false);
      return;
    }

    const startedAt = startFaceApiTimer();
    faceApiLog("attendance-report:status:start", {
      userId: user.id,
      email: user.email ?? null,
    });

    setIsLoading(true);
    setErrorMessage(null);
    setStatus(null);
    const outcome: PrepareOutcome = await prepareUpayaPresensi({
      userId: user.id,
    });

    if (!isMountedRef.current) {
      if (outcome.status === "ready") cancelUpayaPresensi(outcome.attemptId);
      return;
    }

    if (outcome.status === "ready") {
      setStatus(outcome.precheck);
      navigateToCamera(outcome.precheck, outcome.attemptId);
    } else if (outcome.status === "blocked") {
      if (outcome.precheck) {
        setStatus(outcome.precheck);
      } else if (outcome.reason === "permission_denied") {
        setErrorMessage(
          "Izin lokasi ditolak. Absensi tidak dapat dilanjutkan.",
        );
      } else {
        setErrorMessage(
          "Terdeteksi lokasi palsu. Matikan pengaturan lokasi palsu untuk melanjutkan.",
        );
      }
    } else {
      faceApiError("attendance-report:status:failed", {
        durationMs: elapsedMs(startedAt),
        code: outcome.code,
      });
      setErrorMessage("Terjadi kesalahan tidak diketahui.");
    }

    faceApiLog("attendance-report:status:finish", {
      durationMs: elapsedMs(startedAt),
    });
    setIsLoading(false);
  }, [user, navigateToCamera]);

  // Jalankan pengecekan saat komponen pertama kali dimuat
  useEffect(() => {
    fetchAttendanceStatus();
  }, [fetchAttendanceStatus]);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
      }
      return true;
    };
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );
    return () => backHandler.remove();
  }, [router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const statusMeta = useMemo(() => {
    if (isLoading) {
      return {
        icon: Loader2,
        color: "text-blue-600 dark:text-blue-500",
        message: "Memeriksa Status...",
      };
    }

    if (errorMessage) {
      return {
        icon: MapPinOff,
        color: "text-red-600 dark:text-red-500",
        message: errorMessage,
      };
    }

    if (status?.actionable) {
      // Cek apakah statusnya terlambat
      if (status.details?.status === "Terlambat") {
        return {
          icon: Clock, // Icon baru untuk terlambat
          color: "text-orange-500 dark:text-orange-400", // Warna oranye untuk peringatan
          message: status.message,
        };
      }
      // Jika tidak, berarti hadir tepat waktu
      return {
        icon: CheckCircle2,
        color: "text-green-600 dark:text-green-500",
        message: status.message,
      };
    }

    return {
      icon: HelpCircle,
      color: "text-blue-600 dark:text-blue-500",
      message: status?.message || "Status Tidak Diketahui",
    };
  }, [errorMessage, isLoading, status]);

  const showLocationDetails = Boolean(
    !errorMessage && status?.actionable && status.details?.location_name,
  );
  const locationName = status?.details?.location_name;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Kustom */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2 mr-1"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-gray-900 dark:text-gray-100"
          />
        </TouchableOpacity>
        <Text variant="h3" className="text-gray-900 dark:text-gray-100">
          Lapor Absensi
        </Text>
      </View>

      {/* Konten Utama */}
      <View className="flex-1 justify-center items-center px-6 py-8">
        <Card className="w-full max-w-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-lg">
          <CardHeader className="items-center pb-4">
            <View className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
              {statusMeta.icon === Loader2 ? (
                <Animated.View style={animatedStyle}>
                  <Icon
                    as={statusMeta.icon}
                    className={`size-12 ${statusMeta.color}`}
                  />
                </Animated.View>
              ) : (
                <Icon
                  as={statusMeta.icon}
                  className={`size-12 ${statusMeta.color}`}
                />
              )}
            </View>
          </CardHeader>

          <CardContent className="items-center space-y-6 pt-2">
            {/* Status Message */}
            <View className="space-y-2 w-full">
              <CardTitle className="text-xl text-center text-gray-900 dark:text-gray-100">
                {statusMeta.message}
              </CardTitle>

              {/* Location Info */}
              {showLocationDetails && locationName && (
                <View className="flex-row items-center justify-center gap-1 pt-1">
                  <Icon
                    as={MapPin}
                    className="size-4 text-gray-600 dark:text-gray-400"
                  />
                  <Text className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {locationName}
                  </Text>
                </View>
              )}
            </View>

            {/* Refresh Button */}
            <Button
              variant="outline"
              className="w-full border-blue-500 dark:border-blue-600 bg-white dark:bg-gray-900"
              onPress={fetchAttendanceStatus}
              disabled={isLoading}
            >
              <Icon
                as={RefreshCw}
                className={`size-5 mr-2 ${isLoading ? "text-gray-400" : "text-blue-600 dark:text-blue-500"}`}
              />
              <Text
                className={`font-medium ${isLoading ? "text-gray-400" : "text-blue-600 dark:text-blue-500"}`}
              >
                {isLoading ? "Memuat..." : "Segarkan Status"}
              </Text>
            </Button>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}
