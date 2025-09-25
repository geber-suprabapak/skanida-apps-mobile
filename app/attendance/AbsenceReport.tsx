// --- NECESSARY IMPORTS ---
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, Alert, TouchableOpacity, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  RefreshCw,
  Loader2,
  ChevronLeft,
  MapPin,
  MapPinOff,
  HelpCircle,
} from "lucide-react-native";

// --- TYPES AND INTERFACES ---
type AbsenceType = "present" | "home";
type LocationCheckStatus = "checking" | "verified" | "failed" | "out_of_range";

// --- CONSTANTS ---

const SCHOOL_COORDINATES = {
  latitude: -7.4503,
  longitude: 110.2241,
} as const;

const MAX_DISTANCE_METERS = 500;
const AUTO_NAVIGATE_DELAY_MS = 1000;

// Location optimization constants (removed fast location)
const LOCATION_CONFIG = {
  HIGH_ACCURACY: Location.Accuracy.High,
  // Timeout 10 detik untuk lokasi diperlukan karena:
  // 1. GPS membutuhkan waktu untuk mendapatkan sinyal satelit yang akurat
  // 2. High accuracy mode memerlukan triangulasi dari multiple satellites
  // 3. Dalam ruangan atau area dengan sinyal GPS lemah butuh waktu lebih lama
  // 4. Akurasi lokasi sangat penting untuk validasi absensi di area sekolah
  // 5. Mencegah false negative pada kondisi sinyal GPS yang sedang loading
  HIGH_TIMEOUT: 10000,
} as const;

// --- UTILITY FUNCTIONS ---
const createLogger = (component: string) => ({
  debug: (message: string, data?: any) => {
    console.log(
      `${new Date().toISOString()} 🔍 [${component}] ${message}`,
      data || "",
    );
  },
  info: (message: string, data?: any) => {
    console.info(
      `${new Date().toISOString()} ℹ️ [${component}] ${message}`,
      data || "",
    );
  },
  warn: (message: string, data?: any) => {
    console.warn(
      `${new Date().toISOString()} ⚠️ [${component}] ${message}`,
      data || "",
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `${new Date().toISOString()} ❌ [${component}] ${message}`,
      error || "",
    );
  },
});

const logger = createLogger("AbsenceReport");

// --- MAIN COMPONENT ---
const AbsenceReport = () => {
  // --- HOOKS AND STATE ---
  const router = useRouter();

  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObject | null>(null);
  const [locationStatus, setLocationStatus] =
    useState<LocationCheckStatus>("checking");
  const [statusMessage, setStatusMessage] = useState("Initializing...");

  // Absence state
  const [currentAbsenceType, setCurrentAbsenceType] =
    useState<AbsenceType | null>(null);
  const [canProceedToCamera, setCanProceedToCamera] = useState(false);
  const [morningAbsenceCompleted, setMorningAbsenceCompleted] = useState<
    string | null
  >(null);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

  // --- MEMOIZED VALUES ---
  const todayDateString = useMemo(
    () => new Date().toISOString().split("T")[0],
    [],
  );

  // --- UTILITY FUNCTIONS ---
  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371e3;
      const φ1 = (lat1 * Math.PI) / 180;
      const φ2 = (lat2 * Math.PI) / 180;
      const Δφ = ((lat2 - lat1) * Math.PI) / 180;
      const Δλ = ((lon2 - lon1) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c;
    },
    [],
  );

  // Get location with high accuracy only
  const getLocationWithHighAccuracy =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      try {
        logger.debug("Getting location with high accuracy");
        setStatusMessage("Mendapatkan lokasi dengan akurasi tinggi...");

        const locationPromise = Location.getCurrentPositionAsync({
          accuracy: LOCATION_CONFIG.HIGH_ACCURACY,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Location timeout")),
            LOCATION_CONFIG.HIGH_TIMEOUT,
          ),
        );

        const location = await Promise.race([locationPromise, timeoutPromise]);

        logger.info("High accuracy location acquired successfully", {
          accuracy: location.coords.accuracy,
        });

        return location;
      } catch (error: any) {
        logger.error("High accuracy location failed", error);

        if (error?.message?.includes("timeout")) {
          setStatusMessage(
            "Gagal mendapatkan lokasi: Waktu habis. Pastikan GPS aktif.",
          );
        } else {
          setStatusMessage(
            "Gagal mendapatkan lokasi. Pastikan GPS dan izin lokasi aktif.",
          );
        }
        return null;
      }
    }, []);

  const navigateToCamera = useCallback(() => {
    if (
      !currentLocation ||
      !userId ||
      !currentAbsenceType ||
      !canProceedToCamera
    ) {
      logger.error("Cannot navigate to camera - missing required data", {
        hasLocation: !!currentLocation,
        hasUserId: !!userId,
        hasAbsenceType: !!currentAbsenceType,
        canProceed: canProceedToCamera,
      });
      Alert.alert(
        "Error",
        "Tidak dapat melanjutkan, data tidak lengkap atau kondisi tidak terpenuhi.",
      );
      return;
    }

    logger.info("Navigating to camera", { absenceType: currentAbsenceType });
    router.push({
      pathname: "/attendance/CameraAttendance",
      params: {
        latitude: currentLocation.coords.latitude.toString(),
        longitude: currentLocation.coords.longitude.toString(),
        userId,
        absenceType: currentAbsenceType,
      },
    });
  }, [currentLocation, userId, currentAbsenceType, canProceedToCamera, router]);

  // --- CORE FUNCTIONS ---
  const checkUserAuthentication = useCallback(async (): Promise<
    string | null
  > => {
    try {
      logger.debug("Checking user authentication");
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        logger.error("Authentication error", error);
        throw error;
      }

      if (!data?.user) {
        logger.warn("No authenticated user found");
        Alert.alert(
          "Error",
          "Pengguna tidak ditemukan. Silakan login kembali.",
        );
        router.replace("/auth/Login");
        return null;
      }

      logger.info("User authenticated successfully", { userId: data.user.id });
      return data.user.id;
    } catch (error) {
      logger.error("Error in user authentication check", error);
      Alert.alert("Error", "Gagal mendapatkan data pengguna");
      throw error;
    }
  }, [router]);

  const determineAbsenceType = useCallback(
    async (currentUserId: string): Promise<AbsenceType | null> => {
      logger.debug("Determining absence type for user", {
        userId: currentUserId,
        date: todayDateString,
      });

      // Check local state first for performance
      if (morningAbsenceCompleted === todayDateString) {
        logger.info("Morning absence already completed (local state)");
        return "home";
      }

      // Reset if date changed
      if (
        morningAbsenceCompleted &&
        morningAbsenceCompleted !== todayDateString
      ) {
        logger.debug("Resetting morning absence state for new day");
        setMorningAbsenceCompleted(null);
      }

      // Check network connectivity
      try {
        const netInfoState = await NetInfo.fetch();
        if (!netInfoState.isConnected || !netInfoState.isInternetReachable) {
          logger.warn("No internet connection available");
          setStatusMessage(
            "Tidak ada koneksi internet. Silakan periksa koneksi Anda.",
          );
          return null;
        }
      } catch (error) {
        logger.warn("Network check failed", error);
      }

      // Query database for today's attendance
      try {
        const { data: lastAbsenceData, error: lastAbsenceError } =
          await supabase
            .from("absences")
            .select("status, created_at")
            .eq("user_id", currentUserId)
            .eq("date", todayDateString)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (lastAbsenceError) {
          if (lastAbsenceError.code === "PGRST116") {
            // No data found for today - check if there's any record from previous days
            logger.info("No absence record found for today (PGRST116)");

            // Query for the most recent absence record regardless of date
            const { data: lastAnyAbsenceData, error: lastAnyAbsenceError } =
              await supabase
                .from("absences")
                .select("status, created_at, date")
                .eq("user_id", currentUserId)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

            if (
              lastAnyAbsenceError &&
              lastAnyAbsenceError.code !== "PGRST116"
            ) {
              logger.error(
                "Error querying previous absence records",
                lastAnyAbsenceError,
              );
              setStatusMessage(
                `Gagal memeriksa riwayat absensi: ${lastAnyAbsenceError.message}`,
              );
              return null;
            }

            if (lastAnyAbsenceData) {
              const lastAbsenceDate = new Date(lastAnyAbsenceData.created_at)
                .toISOString()
                .split("T")[0];
              logger.info("Found previous absence record", {
                status: lastAnyAbsenceData.status,
                date: lastAnyAbsenceData.date,
                createdDate: lastAbsenceDate,
                today: todayDateString,
              });

              // If the last record is from a previous day, allow morning attendance
              if (lastAbsenceDate !== todayDateString) {
                logger.info(
                  "Last absence record is from previous day, allowing morning attendance",
                );
                return "present";
              }
            }

            // No previous records or same day record, default to morning attendance
            logger.info("Defaulting to morning attendance (present)");
            return "present";
          } else {
            logger.error("Database query failed", lastAbsenceError);
            setStatusMessage(
              `Gagal memeriksa status absensi: ${lastAbsenceError.message}`,
            );
            return null;
          }
        }

        if (lastAbsenceData) {
          // Check if the record is actually from today by comparing created_at date
          const recordDate = new Date(lastAbsenceData.created_at)
            .toISOString()
            .split("T")[0];

          logger.info("Found existing absence record", {
            status: lastAbsenceData.status,
            recordDate,
            today: todayDateString,
          });

          // If the record is from a previous day, allow morning attendance
          if (recordDate !== todayDateString) {
            logger.info(
              "Found record is from previous day, allowing morning attendance",
            );
            return "present";
          }

          // Record is from today, check status
          switch (lastAbsenceData.status) {
            case "Hadir":
              setMorningAbsenceCompleted(todayDateString);
              return "home";
            case "Pulang":
              setStatusMessage(
                "Anda sudah menyelesaikan absensi (Hadir dan Pulang) untuk hari ini.",
              );
              return null;
            default:
              logger.debug(
                "Found incomplete absence record, proceeding with morning attendance",
              );
              return "present";
          }
        } else {
          // This should not happen after handling PGRST116, but keeping as fallback
          logger.info(
            "No absence record found for today, proceeding with morning attendance",
          );
          return "present";
        }
      } catch (error) {
        logger.error("Error querying absence data", error);
        setStatusMessage("Gagal memeriksa status absensi dari database.");
        return null;
      }
    },
    [todayDateString, morningAbsenceCompleted],
  );

  const requestLocationPermissionAndGet =
    useCallback(async (): Promise<Location.LocationObject | null> => {
      try {
        logger.debug("Checking location permission");

        let { status } = await Location.getForegroundPermissionsAsync();

        if (status !== "granted") {
          logger.debug("Requesting location permission");
          setStatusMessage("Meminta izin lokasi...");

          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;

          if (status !== "granted") {
            logger.warn("Location permission denied");
            setStatusMessage(
              "Izin lokasi ditolak. Aktifkan izin lokasi untuk melanjutkan.",
            );
            return null;
          }
        }

        return await getLocationWithHighAccuracy();
      } catch (error: any) {
        logger.error("Location permission or acquisition failed", error);
        setStatusMessage(
          "Gagal mendapatkan izin lokasi atau lokasi tidak tersedia.",
        );
        return null;
      }
    }, [getLocationWithHighAccuracy]);

  const performFullAbsenceCheck = useCallback(async () => {
    logger.info("Starting optimized absence check");
    setIsLoading(true);
    setLocationStatus("checking");
    setCanProceedToCamera(false);
    setStatusMessage("Memeriksa status absensi dan lokasi...");

    try {
      const [authenticatedUserId, location] = await Promise.all([
        checkUserAuthentication(),
        requestLocationPermissionAndGet(),
      ]);

      if (!authenticatedUserId) {
        setIsLoading(false);
        return;
      }
      setUserId(authenticatedUserId);

      if (!location) {
        setLocationStatus("failed");
        setIsLoading(false);
        return;
      }
      setCurrentLocation(location);

      setStatusMessage("Memeriksa status absensi...");
      const absenceType = await determineAbsenceType(authenticatedUserId);
      if (!absenceType) {
        setIsLoading(false);
        return;
      }
      setCurrentAbsenceType(absenceType);

      const actionText =
        absenceType === "present" ? "absen masuk" : "absen pulang";
      setStatusMessage(`Memverifikasi lokasi untuk ${actionText}...`);

      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        SCHOOL_COORDINATES.latitude,
        SCHOOL_COORDINATES.longitude,
      );

      const withinRange = distance <= MAX_DISTANCE_METERS;

      if (withinRange) {
        logger.info("Location verified - within range", {
          distance: Math.round(distance),
          accuracy: location.coords.accuracy,
        });
        setLocationStatus("verified");
        setCanProceedToCamera(true);
        setStatusMessage(
          `${absenceType === "present" ? "Absen Masuk" : "Absen Pulang"}: Lokasi terverifikasi (${Math.round(distance)}m). Lanjut ke kamera.`,
        );
      } else {
        logger.warn("Location verification failed - out of range", {
          distance: Math.round(distance),
          accuracy: location.coords.accuracy,
        });
        setLocationStatus("out_of_range");
        setStatusMessage(
          `Anda berada di luar jangkauan (${Math.round(distance)}m dari sekolah). Tidak dapat melanjutkan absensi.`,
        );
      }
    } catch (error) {
      logger.error("Error in optimized absence check", error);
      setLocationStatus("failed");
      setStatusMessage("Terjadi kesalahan saat memeriksa status absensi.");
    } finally {
      setIsLoading(false);
    }
  }, [
    checkUserAuthentication,
    requestLocationPermissionAndGet,
    determineAbsenceType,
    calculateDistance,
  ]);

  // --- EFFECTS ---
  useEffect(() => {
    logger.info("Component mounted, starting initial check");
    performFullAbsenceCheck();
  }, [performFullAbsenceCheck]);

  // Auto-navigate to camera when conditions are met (faster)
  useEffect(() => {
    if (
      locationStatus === "verified" &&
      currentLocation &&
      !isLoading &&
      canProceedToCamera &&
      currentAbsenceType
    ) {
      logger.debug("Auto-navigating to camera", {
        delay: AUTO_NAVIGATE_DELAY_MS,
      });
      const timer = setTimeout(navigateToCamera, AUTO_NAVIGATE_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [
    locationStatus,
    currentLocation,
    isLoading,
    canProceedToCamera,
    currentAbsenceType,
    navigateToCamera,
  ]);

  // --- RENDER HELPERS ---
  const getStatusColorClass = (): string => {
    if (locationStatus === "verified" && canProceedToCamera) {
      return "text-green-600";
    }
    if (locationStatus === "out_of_range" || locationStatus === "failed") {
      return "text-red-600";
    }
    return "text-gray-500";
  };

  // --- RENDER ---
  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-gray-900">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom Header */}
      <View className="flex-row items-center p-4 border-b border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800">
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <Icon
            as={ChevronLeft}
            className="size-6 text-black dark:text-white"
          />
        </TouchableOpacity>
        <Text className="text-xl font-semibold text-black dark:text-white">
          Lapor Absensi
        </Text>
      </View>

      {/* Main Content */}
      <View className="flex-1 px-4 py-6 justify-center items-center bg-background dark:bg-gray-900">
        {isLoading ? (
          <Icon as={Loader2} className="size-8 text-black dark:text-white" />
        ) : (
          <Card className="w-full max-w-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
            <CardHeader className="items-center">
              {locationStatus === "verified" && canProceedToCamera ? (
                <Icon
                  as={MapPin}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              ) : locationStatus === "out_of_range" ||
                locationStatus === "failed" ? (
                <Icon
                  as={MapPinOff}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              ) : (
                <Icon
                  as={HelpCircle}
                  className={`size-8 ${getStatusColorClass()}`}
                />
              )}
            </CardHeader>
            <CardContent className="items-center">
              <CardTitle className="text-xl text-center mb-2 text-gray-800 dark:text-white">
                Status Absensi
              </CardTitle>
              <CardDescription className="text-base text-center mb-4 text-gray-600 dark:text-gray-300">
                {statusMessage}
              </CardDescription>

              {/* Success State */}
              {locationStatus === "verified" &&
                canProceedToCamera &&
                currentAbsenceType && (
                  <View className="p-3 rounded-md bg-green-100 w-full items-center">
                    <Text className="text-lg font-semibold text-green-700">
                      {currentAbsenceType === "present"
                        ? "Siap untuk Absen Masuk"
                        : "Siap untuk Absen Pulang"}
                    </Text>
                    <Text className="text-sm text-green-600">
                      Anda akan diarahkan ke kamera.
                    </Text>
                  </View>
                )}

              {/* Error State */}
              {(locationStatus === "out_of_range" ||
                locationStatus === "failed") && (
                <View className="p-3 rounded-md bg-red-100 w-full items-center">
                  <Text className="text-lg font-semibold text-red-700">
                    Tidak Dapat Melanjutkan
                  </Text>
                  <Text className="text-sm text-red-600">
                    {locationStatus === "out_of_range"
                      ? "Anda berada di luar jangkauan sekolah."
                      : "Terjadi kesalahan saat memverifikasi lokasi."}
                  </Text>
                </View>
              )}

              {/* Completed State */}
              {!canProceedToCamera &&
                !isLoading &&
                statusMessage.includes("sudah menyelesaikan absensi") && (
                  <View className="p-3 rounded-md bg-sky-100 w-full items-center">
                    <Text className="text-lg font-semibold text-sky-700">
                      Absensi Selesai
                    </Text>
                    <Text className="text-sm text-sky-600">
                      Tidak ada tindakan lebih lanjut untuk hari ini.
                    </Text>
                  </View>
                )}
            </CardContent>
          </Card>
        )}

        {/* Refresh Button */}
        <Button
          variant="outline"
          className="mt-8 w-full max-w-md border-sky-500 dark:border-sky-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          onPress={performFullAbsenceCheck}
          disabled={isLoading}
        >
          <Icon
            as={RefreshCw}
            className="size-5 text-sky-500 dark:text-sky-400 mr-2"
          />
          <Text className="text-sky-600 dark:text-sky-400 font-medium">
            {isLoading ? "Memeriksa..." : "Segarkan Status"}
          </Text>
        </Button>
      </View>
    </SafeAreaView>
  );
};

export default AbsenceReport;
