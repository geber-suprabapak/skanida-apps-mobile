// app/attendance/AbsenceReport.tsx

import { useState, useEffect, useCallback } from "react";
import { View, TouchableOpacity, BackHandler } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { supabase } from "~/utils/supabase";
import useAuthStore from "~/store/authStore";

import {
  ChevronLeft,
  Loader2,
  MapPin,
  MapPinOff,
  HelpCircle,
  RefreshCw,
} from "lucide-react-native";

// Definisikan tipe data untuk respons dari RPC kita
type AttendanceActionResponse = {
  actionable: boolean;
  action_type: "check_in" | "check_out" | "none";
  message: string;
  details?: {
    location_name?: string;
  };
};

export default function AbsenceReport() {
  const { user } = useAuthStore();
  const router = useRouter();

  // Hanya butuh beberapa state sederhana
  const [status, setStatus] = useState<AttendanceActionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fungsi inti untuk memeriksa status absensi
  const fetchAttendanceStatus = useCallback(async () => {
    if (!user) {
      setErrorMessage("Sesi pengguna tidak valid, silakan login ulang.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setStatus(null);
    setUserLocation(null);

    try {
      // 1. Minta izin dan dapatkan lokasi
      let { status: permissionStatus } =
        await Location.getForegroundPermissionsAsync();
      if (permissionStatus !== "granted") {
        permissionStatus = (await Location.requestForegroundPermissionsAsync())
          .status;
      }
      if (permissionStatus !== "granted") {
        throw new Error(
          "Izin lokasi ditolak. Absensi tidak dapat dilanjutkan.",
        );
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setUserLocation(location.coords);

      // 2. Keamanan: Deteksi Mock Location
      if (location.mocked) {
        throw new Error(
          "Terdeteksi lokasi palsu. Matikan pengaturan lokasi palsu untuk melanjutkan.",
        );
      }

      // 3. Panggilan Elegan ke Server (Single RPC)
      const { data, error } = await supabase.rpc(
        "get_and_validate_attendance_action",
        {
          p_user_id: user.id,
          p_user_lat: location.coords.latitude,
          p_user_lon: location.coords.longitude,
        },
      );

      console.log("RPC Response:", { data, error });

      if (error) {
        throw new Error(`Gagal memeriksa status: ${error.message}`);
      }

      setStatus(data);
    } catch (e: any) {
      setUserLocation(null);
      setErrorMessage(e.message || "Terjadi kesalahan tidak diketahui.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

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

  const handleProceedToCamera = () => {
    if (
      !status?.actionable ||
      !status.action_type ||
      status.action_type === "none"
    )
      return;

    // Navigasi ke halaman kamera dengan membawa parameter yang diperlukan
    const params: Record<string, string> = {
      actionType: status.action_type,
    };

    if (status.details?.location_name) {
      params.locationName = status.details.location_name;
    }

    if (userLocation) {
      params.latitude = userLocation.latitude.toString();
      params.longitude = userLocation.longitude.toString();
    }

    router.push({
      pathname: "/attendance/CameraAttendance",
      params,
    });
  };

  const getStatusIcon = () => {
    if (isLoading) return Loader2;
    if (errorMessage) return MapPinOff;
    if (status?.actionable) return MapPin;
    return HelpCircle;
  };

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header Kustom */}
      <View className="flex-row items-center p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <Icon
            as={ChevronLeft}
            className="size-6 text-black dark:text-white"
          />
        </TouchableOpacity>
        <Text variant="h2" className="text-black dark:text-white">
          Lapor Absensi
        </Text>
      </View>

      {/* Konten Utama */}
      <View className="flex-1 justify-center items-center p-6">
        <Card className="w-full max-w-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
          <CardHeader className="items-center">
            <Icon
              as={getStatusIcon()}
              className={`size-10 ${errorMessage ? "text-red-600" : "text-blue-600"}`}
            />
          </CardHeader>
          <CardContent className="items-center space-y-4">
            <CardTitle className="text-xl text-center text-gray-800 dark:text-white">
              {isLoading
                ? "Memeriksa Status..."
                : errorMessage || status?.message || "Status Tidak Diketahui"}
            </CardTitle>

            {status && !errorMessage && (
              <Button
                size="lg"
                className="w-full"
                onPress={handleProceedToCamera}
                disabled={!status.actionable || isLoading}
              >
                <Text className="text-white font-medium">
                  {status.action_type === "check_in"
                    ? "Lanjutkan Absen Masuk"
                    : status.action_type === "check_out"
                      ? "Lanjutkan Absen Pulang"
                      : "Tidak ada aksi"}
                </Text>
              </Button>
            )}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          className="mt-6 w-full max-w-sm border-sky-500 dark:border-sky-600 bg-white dark:bg-gray-800"
          onPress={fetchAttendanceStatus}
          disabled={isLoading}
        >
          <Icon
            as={RefreshCw}
            className="size-5 mr-2 text-sky-500 dark:text-sky-400"
          />
          <Text className="text-sky-600 dark:text-sky-400 font-medium">
            {isLoading ? "Memuat..." : "Segarkan Status"}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
