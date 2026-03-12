import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, TouchableOpacity, BackHandler } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
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
import { supabase } from "~/utils/supabase";
import useAuthStore from "~/store/authStore";
import { formatDateWIB } from "~/lib/utils";
import { timeSync } from "~/utils/timeSync";

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

// Definisikan tipe data untuk respons dari RPC kita
type AttendanceActionResponse = {
  actionable: boolean;
  action_type: "check_in" | "check_out" | "none";
  message: string;
  details?: {
    location_name?: string;
    status?: "Hadir" | "Terlambat";
  };
};

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
    (
      statusData: AttendanceActionResponse,
      locationCoords: Location.LocationObjectCoords,
    ) => {
      // Prevent navigation if component is unmounted
      if (!isMountedRef.current) return;

      const params: Record<string, string> = {
        actionType: statusData.action_type,
      };

      if (statusData.details?.location_name) {
        params.locationName = statusData.details.location_name;
      }

      params.latitude = locationCoords.latitude.toString();
      params.longitude = locationCoords.longitude.toString();

      router.push({
        pathname: "/attendance/CameraAttendance",
        params,
      });
    },
    [router],
  );

  // Fungsi inti untuk memeriksa status absensi
  const getCurrentLocation = useCallback(async () => {
    let { status: permissionStatus } =
      await Location.getForegroundPermissionsAsync();
    if (permissionStatus !== "granted") {
      permissionStatus = (await Location.requestForegroundPermissionsAsync())
        .status;
    }
    if (permissionStatus !== "granted") {
      throw new Error("Izin lokasi ditolak. Absensi tidak dapat dilanjutkan.");
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    if (location.mocked) {
      throw new Error(
        "Terdeteksi lokasi palsu. Matikan pengaturan lokasi palsu untuk melanjutkan.",
      );
    }

    return location;
  }, []);

  const checkTodayPermit = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        // Use WIB-synced time for querying
        const todayWIB = formatDateWIB(timeSync.getSyncedTime());
        const startOfDayWIB = `${todayWIB}T00:00:00+07:00`;
        const endOfDayWIB = `${todayWIB}T23:59:59.999+07:00`;

        const { data, error } = await supabase
          .from("perizinan")
          .select("id, approval_status")
          .eq("user_id", userId)
          .gte("tanggal", startOfDayWIB)
          .lte("tanggal", endOfDayWIB);

        if (error) {
          return false;
        }

        // User memiliki izin aktif jika ada izin pending atau approved
        return (
          data &&
          data.length > 0 &&
          data.some(
            (record) =>
              record.approval_status === "pending" ||
              record.approval_status === "approved",
          )
        );
      } catch {
        return false;
      }
    },
    [],
  );

  const fetchAttendanceStatus = useCallback(async () => {
    if (!user) {
      setErrorMessage("Sesi pengguna tidak valid, silakan login ulang.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatus(null);

    try {
      // Check if user has active permit today
      const hasActivePermit = await checkTodayPermit(user.id);
      if (hasActivePermit) {
        throw new Error(
          "Anda sudah mengajukan izin untuk hari ini. Tidak dapat melakukan absensi jika sudah ada izin aktif (pending/approved).",
        );
      }

      const location = await getCurrentLocation();

      const { data, error } = await supabase.rpc(
        "get_and_validate_attendance_action",
        {
          p_user_id: user.id,
          p_user_lat: location.coords.latitude,
          p_user_lon: location.coords.longitude,
        },
      );

      if (error) {
        throw new Error(`Gagal memeriksa status: ${error.message}`);
      }

      setStatus(data);

      const isActionable = Boolean(
        data?.actionable && data.action_type !== "none",
      );

      if (isActionable) {
        navigateToCamera(data, location.coords);
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Terjadi kesalahan tidak diketahui.");
    } finally {
      setIsLoading(false);
    }
  }, [user, getCurrentLocation, checkTodayPermit, navigateToCamera]);

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
