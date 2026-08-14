import { useRouter, Stack, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  BackHandler,
  Image as RNImage,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Trash2,
  Eye,
  EyeOff,
  User,
  Mail,
  GraduationCap,
  Hash,
  Lock,
  Key,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Scan,
  Loader2,
} from "lucide-react-native";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import {
  fetchEnrollmentStatus,
  type EnrollmentStatus,
} from "~/utils/enrollment";
import { faceApiLog } from "~/utils/faceApiDebug";
import {
  fetchFaceApiRuntimeStatus,
  type FaceApiRuntimeStatusResult,
} from "~/utils/faceApiRuntime";
import {
  changePassword as changeBffPassword,
  getProfile,
  updateAvatar as updateBffAvatar,
} from "~/utils/bffMobileApi";

// --- Utility Functions ---

const PROFILE_CACHE_KEY = "user_profile_cache";

const clearProfileCache = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    if (__DEV__) console.log("Failed to clear profile cache:", error);
  }
};

// --- Interfaces ---

export default function ManageAccount() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";

  // --- Profile State ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [absenceNumber, setAbsenceNumber] = useState("");
  const [className, setClassName] = useState("");
  const [nis, setNis] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAvatarOptionsVisible, setIsAvatarOptionsVisible] = useState(false);

  // Initial values for change detection
  const [initialData, setInitialData] = useState({
    name: "",
    absenceNumber: "",
    className: "",
    nis: "",
    avatarPath: null as string | null,
  });

  // --- Password State ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(false);

  // --- Enrollment State ---
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>("loading");
  const [enrollmentError, setEnrollmentError] = useState<string>("");
  const [faceApiRuntime, setFaceApiRuntime] =
    useState<FaceApiRuntimeStatusResult | null>(null);
  const [isCheckingFaceApi, setIsCheckingFaceApi] = useState(true);

  // --- Fetch Profile Data ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        const data = await getProfile();
        let profileName =
          user.user_metadata?.name || user.user_metadata?.full_name || "";
        let profileEmail = user.email || "";
        let profileAbsence = user.user_metadata?.absence_number || "";
        let profileClass = user.user_metadata?.class_name || "";
        let profileNis = user.user_metadata?.nis || "";
        let profileAvatar = user.user_metadata?.avatar_url || null;

        if (data) {
          profileName = data.full_name || profileName;
          profileEmail = data.email || profileEmail;
          profileAbsence = data.absence_number
            ? String(data.absence_number)
            : profileAbsence;
          profileClass = data.class_name || profileClass;
          profileNis = data.nis || profileNis;
          profileAvatar = data.avatar_url || profileAvatar;
        }

        setName(profileName);
        setEmail(profileEmail);
        setAbsenceNumber(profileAbsence);
        setClassName(profileClass);
        setNis(profileNis);
        const normalizedAvatarPath = profileAvatar || null;

        setAvatarPath(normalizedAvatarPath);
        setAvatarUrl(normalizedAvatarPath);

        setInitialData({
          name: profileName,
          absenceNumber: profileAbsence,
          className: profileClass,
          nis: profileNis,
          avatarPath: normalizedAvatarPath,
        });
      } catch (error) {
        if (__DEV__) console.error("Error fetching profile:", error);
      }
    };

    fetchProfileData();
  }, [user]);

  // --- Check Face Enrollment Status ---
  const checkEnrollmentStatus = useCallback(async () => {
    setEnrollmentStatus("loading");
    setEnrollmentError("");

    const result = await fetchEnrollmentStatus();
    faceApiLog("settings:enroll-status:result", {
      userId: user?.id ?? null,
      result,
    });

    setEnrollmentStatus(result.status);
    if (result.error) {
      setEnrollmentError(result.error);
    }
  }, [user?.email, user?.id]);

  const checkFaceApiRuntime = useCallback(async () => {
    setIsCheckingFaceApi(true);
    const result = await fetchFaceApiRuntimeStatus();
    faceApiLog("settings:runtime-status:result", {
      userId: user?.id ?? null,
      result,
    });
    setFaceApiRuntime(result);
    setIsCheckingFaceApi(false);
  }, [user?.id]);

  const refreshFaceVerificationStatus = useCallback(async () => {
    await Promise.all([checkEnrollmentStatus(), checkFaceApiRuntime()]);
  }, [checkEnrollmentStatus, checkFaceApiRuntime]);

  useFocusEffect(
    useCallback(() => {
      void refreshFaceVerificationStatus();
    }, [refreshFaceVerificationStatus]),
  );

  // --- Avatar Logic ---
  const pickImageFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin Ditolak", "Kami membutuhkan izin akses galeri foto.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      if (__DEV__) console.error("Error picking image:", error);
    } finally {
      setIsAvatarOptionsVisible(false);
    }
  };

  const captureImageWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin Ditolak", "Kami membutuhkan izin akses kamera.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadAvatar(result.assets[0].uri);
      }
    } catch (error) {
      if (__DEV__) console.error("Error capturing image:", error);
    } finally {
      setIsAvatarOptionsVisible(false);
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    setUploadingAvatar(true);

    try {
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const newAvatarUrl = await updateBffAvatar({
        uri,
        name: fileName,
        type: contentType,
      });

      if (!newAvatarUrl) throw new Error("Gagal mendapatkan URL avatar.");

      setAvatarPath(newAvatarUrl);
      setAvatarUrl(newAvatarUrl);
      setInitialData((current) => ({
        ...current,
        avatarPath: newAvatarUrl,
      }));
      await clearProfileCache();

      Alert.alert("Sukses", "Foto profil berhasil diperbarui.");
    } catch (error: any) {
      if (__DEV__) console.error("Upload error:", error);
      Alert.alert("Gagal Upload", "Terjadi kesalahan saat mengunggah foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarPath) {
      Alert.alert("Info", "Tidak ada foto untuk dihapus.");
      return;
    }

    Alert.alert(
      "Hapus Foto",
      "Apakah Anda yakin ingin menghapus foto profil?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            setIsAvatarOptionsVisible(false);
            setUploadingAvatar(true);
            try {
              await updateBffAvatar(null, true);

              setAvatarPath(null);
              setAvatarUrl(null);
              setInitialData((current) => ({
                ...current,
                avatarPath: null,
              }));
              await clearProfileCache();

              Alert.alert("Sukses", "Foto profil telah dihapus.");
            } catch {
              Alert.alert("Error", "Gagal menghapus foto profil.");
            } finally {
              setUploadingAvatar(false);
            }
          },
        },
      ],
    );
  };

  // --- Change Password Logic ---
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Semua kolom password harus diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi password baru tidak cocok.");
      return;
    }
    const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      Alert.alert(
        "Error",
        "Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.",
      );
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert("Error", "Password baru harus berbeda dari password lama.");
      return;
    }

    setPasswordLoading(true);
    try {
      await changeBffPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      Alert.alert(
        "Sukses",
        "Password berhasil diubah. Demi keamanan, Anda akan logout dan diminta login kembali.",
        [
          {
            text: "OK",
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace("/auth/Login");
            },
          },
        ],
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const errorMessage = error?.message || "Gagal mengubah password.";
      Alert.alert("Error", errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  // --- Back Handler ---
  useEffect(() => {
    const onBackPress = () => {
      // Simple check for unsaved profile changes
      const hasChanges =
        name !== initialData.name ||
        absenceNumber !== initialData.absenceNumber ||
        className !== initialData.className ||
        nis !== initialData.nis ||
        avatarPath !== initialData.avatarPath;

      if (hasChanges) {
        Alert.alert(
          "Perubahan Belum Disimpan",
          "Anda memiliki perubahan profil yang belum disimpan. Yakin ingin kembali?",
          [
            { text: "Batal", style: "cancel" },
            {
              text: "Ya, Kembali",
              style: "destructive",
              onPress: () => router.back(),
            },
          ],
        );
        return true;
      }

      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => backHandler.remove();
  }, [name, absenceNumber, className, nis, avatarPath, initialData, router]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-background">
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Simple Header */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-gray-100 dark:border-gray-800">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 items-center justify-center border border-gray-100 dark:border-gray-700"
        >
          <Icon
            as={ChevronLeft}
            className="size-6 text-gray-900 dark:text-gray-100"
          />
        </TouchableOpacity>

        <Text className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Kelola Akun
        </Text>

        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- SECTION 1: EDIT PROFILE --- */}
        <View className="px-5 mt-2">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-4 ml-1">
            Edit Profil
          </Text>

          {/* Avatar Card */}
          <Card className="p-6 mb-6 items-center bg-card border-border shadow-sm rounded-2xl">
            <View className="relative mb-4">
              {uploadingAvatar ? (
                <View className="w-28 h-28 rounded-2xl items-center justify-center bg-muted">
                  <ActivityIndicator size="large" color="#3b82f6" />
                </View>
              ) : (
                <View>
                  {avatarUrl ? (
                    <RNImage
                      source={{ uri: avatarUrl }}
                      style={{ width: 112, height: 112, borderRadius: 24 }}
                    />
                  ) : (
                    <View
                      className="rounded-2xl items-center justify-center bg-blue-600"
                      style={{ width: 112, height: 112 }}
                    >
                      <Text className="text-white text-4xl font-bold">
                        {(name || user?.email || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl items-center justify-center shadow-md bg-blue-600 border-2 border-white"
                    onPress={() => setIsAvatarOptionsVisible(true)}
                    activeOpacity={0.9}
                  >
                    <Icon as={Camera} className="size-5 text-white" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <Text className="text-foreground font-bold text-lg text-center">
              {name || "User"}
            </Text>
          </Card>

          {/* Profile Form */}
          <View className="space-y-4 mb-6">
            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                Nama Lengkap
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon as={User} className="size-5 text-muted-foreground" />
                </View>
                <Input
                  value={name}
                  onChangeText={setName}
                  editable={false}
                  className="pl-10 h-12 bg-muted/50 text-muted-foreground border-transparent"
                  placeholder="Nama Lengkap"
                />
              </View>
            </View>

            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                Email
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon as={Mail} className="size-5 text-muted-foreground" />
                </View>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  editable={false}
                  className="pl-10 h-12 bg-muted/50 text-muted-foreground border-transparent"
                />
              </View>
            </View>

            <View className="flex-row gap-4">
              <View className="flex-1">
                <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                  Kelas
                </Text>
                <View className="relative">
                  <View className="absolute left-3 top-3 z-10">
                    <Icon
                      as={GraduationCap}
                      className="size-5 text-muted-foreground"
                    />
                  </View>
                  <Input
                    value={className}
                    onChangeText={setClassName}
                    editable={false}
                    className="pl-10 h-12 bg-muted/50 text-muted-foreground border-transparent"
                    placeholder="Contoh: XII RPL 1"
                  />
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                  No. Absen
                </Text>
                <View className="relative">
                  <View className="absolute left-3 top-3 z-10">
                    <Icon as={Hash} className="size-5 text-muted-foreground" />
                  </View>
                  <Input
                    value={absenceNumber}
                    onChangeText={setAbsenceNumber}
                    editable={false}
                    keyboardType="numeric"
                    className="pl-10 h-12 bg-muted/50 text-muted-foreground border-transparent"
                    placeholder="00"
                  />
                </View>
              </View>
            </View>

            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                NIS / NISN
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon
                    as={CreditCard}
                    className="size-5 text-muted-foreground"
                  />
                </View>
                <Input
                  value={nis}
                  onChangeText={setNis}
                  editable={false}
                  keyboardType="numeric"
                  className="pl-10 h-12 bg-muted/50 text-muted-foreground border-transparent"
                  placeholder="Nomor Induk Siswa"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View className="h-2 bg-muted/20 my-2" />

        {/* --- SECTION: FACE ENROLLMENT --- */}
        <View className="px-5 mt-6">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-4 ml-1">
            Verifikasi Wajah
          </Text>

          <Card className="p-5 mb-2 bg-card border-border shadow-sm rounded-2xl">
            {(enrollmentStatus === "loading" || isCheckingFaceApi) && (
              <View className="flex-row items-center py-2">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="text-muted-foreground ml-3">
                  Memeriksa status wajah dan server...
                </Text>
              </View>
            )}

            {enrollmentStatus === "enrolled" && (
              <View className="flex-row items-center py-2">
                <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                  <Icon as={CheckCircle} className="size-6 text-green-600" />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-foreground font-medium">
                    Wajah Sudah Terdaftar
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    Data wajah Anda tersimpan untuk verifikasi absensi
                  </Text>
                </View>
              </View>
            )}

            {enrollmentStatus === "not_enrolled" && (
              <View>
                <View className="flex-row items-center py-2 mb-3">
                  <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center">
                    <Icon as={AlertCircle} className="size-6 text-amber-600" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-medium">
                      Wajah Belum Terdaftar
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Daftarkan wajah untuk mengaktifkan fitur absensi
                    </Text>
                  </View>
                </View>
                <Button
                  variant="default"
                  size="default"
                  onPress={() => {
                    faceApiLog("settings:navigate-enroll", {
                      enrollmentStatus,
                      enrollmentError,
                      userId: user?.id ?? null,
                    });
                    router.push("./enroll");
                  }}
                  className="w-full bg-blue-600"
                >
                  <Icon as={Scan} className="size-5 text-white mr-2" />
                  <Text className="text-white font-semibold">
                    Daftar Sekarang
                  </Text>
                </Button>
              </View>
            )}

            {enrollmentStatus === "error" && (
              <View>
                <View className="flex-row items-center py-2 mb-3">
                  <View className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center">
                    <Icon as={AlertCircle} className="size-6 text-red-600" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-foreground font-medium">
                      Gagal Memeriksa Status
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {enrollmentError || "Terjadi kesalahan"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {faceApiRuntime && (
              <View className="mt-4 pt-4 border-t border-border/60">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-foreground font-semibold">
                    Status Server
                  </Text>
                  <View
                    className={`px-2.5 py-1 rounded-full ${
                      faceApiRuntime.state === "healthy"
                        ? "bg-green-500/15"
                        : faceApiRuntime.state === "unhealthy"
                          ? "bg-amber-500/15"
                          : "bg-red-500/15"
                    }`}
                  >
                    <Text
                      className={`text-[11px] font-semibold ${
                        faceApiRuntime.state === "healthy"
                          ? "text-green-600"
                          : faceApiRuntime.state === "unhealthy"
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}
                    >
                      {faceApiRuntime.state === "healthy"
                        ? "SIAP"
                        : faceApiRuntime.state === "unhealthy"
                          ? "BELUM SIAP"
                          : faceApiRuntime.state === "misconfigured"
                            ? "KONFIG"
                            : "OFFLINE"}
                    </Text>
                  </View>
                </View>

                <Text className="text-xs text-muted-foreground mb-4">
                  {faceApiRuntime.message}
                </Text>

                <Button
                  variant="outline"
                  size="default"
                  onPress={refreshFaceVerificationStatus}
                  className="w-full border-border"
                >
                  <Icon as={Loader2} className="size-5 text-foreground mr-2" />
                  <Text className="text-foreground font-semibold">
                    Segarkan Status
                  </Text>
                </Button>
              </View>
            )}
          </Card>
        </View>

        {/* Divider */}
        <View className="h-2 bg-muted/20 my-2" />

        {/* --- SECTION 2: CHANGE PASSWORD --- */}
        <View className="px-5 mt-6">
          <Text className="text-muted-foreground text-xs uppercase tracking-widest font-bold mb-4 ml-1">
            Keamanan Akun
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                Password Lama
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon as={Key} className="size-5 text-muted-foreground" />
                </View>
                <Input
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry={!showAllPasswords}
                  className="pl-10 pr-10 h-12 bg-card"
                  placeholder="Masukkan password saat ini"
                />
                <TouchableOpacity
                  onPress={() => setShowAllPasswords(!showAllPasswords)}
                  className="absolute right-3 top-3 p-1"
                >
                  <Icon
                    as={showAllPasswords ? EyeOff : Eye}
                    className="size-4 text-muted-foreground"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                Password Baru
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon as={Lock} className="size-5 text-muted-foreground" />
                </View>
                <Input
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showAllPasswords}
                  className="pl-10 pr-10 h-12 bg-card"
                  placeholder="Minimal 6 karakter"
                />
              </View>
            </View>

            <View>
              <Text className="text-xs font-medium text-muted-foreground mb-1.5 ml-1">
                Konfirmasi Password Baru
              </Text>
              <View className="relative">
                <View className="absolute left-3 top-3 z-10">
                  <Icon as={Lock} className="size-5 text-muted-foreground" />
                </View>
                <Input
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showAllPasswords}
                  className="pl-10 pr-10 h-12 bg-card"
                  placeholder="Ketik ulang password baru"
                />
              </View>
              {confirmPassword && newPassword !== confirmPassword && (
                <Text className="text-xs text-red-500 mt-1 ml-1">
                  Password tidak cocok
                </Text>
              )}
            </View>

            <Button
              onPress={handleChangePassword}
              disabled={passwordLoading}
              variant="outline"
              className="w-full mt-2 border-primary/20"
            >
              {passwordLoading ? (
                <ActivityIndicator color="#3b82f6" size="small" />
              ) : (
                <Text className="text-primary font-semibold">
                  Ubah Password
                </Text>
              )}
            </Button>
          </View>

          <View className="h-10" />
        </View>
      </ScrollView>

      {/* Avatar Options Modal */}
      <Modal
        visible={isAvatarOptionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAvatarOptionsVisible(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setIsAvatarOptionsVisible(false)}
        >
          <View className="flex-1 bg-black/60 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-card rounded-t-3xl p-6">
                <View className="items-center mb-6">
                  <View className="w-12 h-1.5 bg-muted rounded-full mb-4" />
                  <Text className="font-bold text-lg text-foreground">
                    Ganti Foto Profil
                  </Text>
                </View>

                <View className="space-y-3">
                  <TouchableOpacity
                    onPress={captureImageWithCamera}
                    className="flex-row items-center p-4 bg-muted/30 rounded-2xl active:bg-muted/50"
                  >
                    <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-4">
                      <Icon as={Camera} className="size-5 text-blue-600" />
                    </View>
                    <Text className="font-semibold text-foreground">
                      Ambil Foto
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={pickImageFromGallery}
                    className="flex-row items-center p-4 bg-muted/30 rounded-2xl active:bg-muted/50"
                  >
                    <View className="w-10 h-10 rounded-full bg-purple-100 items-center justify-center mr-4">
                      <Icon as={ImageIcon} className="size-5 text-purple-600" />
                    </View>
                    <Text className="font-semibold text-foreground">
                      Pilih dari Galeri
                    </Text>
                  </TouchableOpacity>

                  {avatarUrl && (
                    <TouchableOpacity
                      onPress={handleRemoveAvatar}
                      className="flex-row items-center p-4 bg-red-50 rounded-2xl active:bg-red-100"
                    >
                      <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-4">
                        <Icon as={Trash2} className="size-5 text-red-600" />
                      </View>
                      <Text className="font-semibold text-red-600">
                        Hapus Foto Saat Ini
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setIsAvatarOptionsVisible(false)}
                  className="mt-6 py-3 items-center"
                >
                  <Text className="font-bold text-muted-foreground">Batal</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
