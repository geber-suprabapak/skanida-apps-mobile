import { useRouter, Stack } from "expo-router";
import React, { useState, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import axios, { isAxiosError } from "axios";

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
import useThemeStore from "~/store/themeStore";
import { supabase, ensureSupabaseInitialized } from "~/utils/supabase";
import { ensureFaceApiConfigured } from "~/utils/secureConfig";
import { extractAvatarPath, getAvatarSignedUrl } from "~/utils/avatar";

// --- Utility Functions ---

const PROFILE_CACHE_KEY = "user_profile_cache";

const clearProfileCache = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    if (__DEV__) console.log("Failed to clear profile cache:", error);
  }
};

const base64ToUint8Array = (base64: string): Uint8Array => {
  const cleaned = base64.replace(/\s/g, "");
  const base64Chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";

  let bufferLength = cleaned.length * 0.75;
  if (cleaned.endsWith("==")) {
    bufferLength -= 2;
  } else if (cleaned.endsWith("=")) {
    bufferLength -= 1;
  }

  const bytes = new Uint8Array(bufferLength);

  let p = 0;
  for (let i = 0; i < cleaned.length; i += 4) {
    const encoded1 = base64Chars.indexOf(cleaned[i]);
    const encoded2 = base64Chars.indexOf(cleaned[i + 1]);
    const encoded3 = base64Chars.indexOf(cleaned[i + 2]);
    const encoded4 = base64Chars.indexOf(cleaned[i + 3]);

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== 64 && encoded3 !== -1) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== 64 && encoded4 !== -1) {
      bytes[p++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }

  return bytes;
};

// --- Interfaces ---

// Enrollment status types
type EnrollmentStatus = "loading" | "enrolled" | "not_enrolled" | "error";

interface EnrollmentStatusResponse {
  is_enrolled: boolean;
  embedding_count: number;
  user_id: string;
}

export default function ManageAccount() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const theme = useThemeStore((state) => state.theme);

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

  // --- Fetch Profile Data ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("user_profiles")
          .select(
            "full_name, email, absence_number, class_name, nis, avatar_url",
          )
          .eq("user_id", user.id)
          .single();

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
          profileAbsence = data.absence_number || profileAbsence;
          profileClass = data.class_name || profileClass;
          profileNis = data.nis || profileNis;
          profileAvatar = data.avatar_url || profileAvatar;
        }

        setName(profileName);
        setEmail(profileEmail);
        setAbsenceNumber(profileAbsence);
        setClassName(profileClass);
        setNis(profileNis);
        const normalizedAvatarPath = profileAvatar
          ? (extractAvatarPath(profileAvatar) ?? profileAvatar)
          : null;
        const resolvedAvatarUrl =
          await getAvatarSignedUrl(normalizedAvatarPath);

        setAvatarPath(normalizedAvatarPath);
        setAvatarUrl(resolvedAvatarUrl);

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
  const checkEnrollmentStatus = async () => {
    try {
      setEnrollmentStatus("loading");

      await ensureSupabaseInitialized();

      const faceApiBaseUrl = await ensureFaceApiConfigured();
      const enrollStatusUrl = `${faceApiBaseUrl}/v1/enroll/status`;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setEnrollmentStatus("error");
        setEnrollmentError("Sesi tidak valid");
        return;
      }

      const response = await axios.get<EnrollmentStatusResponse>(
        enrollStatusUrl,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            Accept: "application/json",
          },
        },
      );

      const data = response.data;
      setEnrollmentStatus(data.is_enrolled ? "enrolled" : "not_enrolled");
    } catch (error) {
      if (__DEV__) console.error("Error checking enrollment status:", error);
      if (isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) {
          setEnrollmentStatus("not_enrolled");
          return;
        }
      }
      setEnrollmentStatus("error");
      setEnrollmentError("Gagal terhubung ke server");
    }
  };

  useEffect(() => {
    checkEnrollmentStatus();
  }, []);

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
      // 1. Upload Image to Storage
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileNameInBucket = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileBytes = base64ToUint8Array(base64Data);

      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(fileNameInBucket, fileBytes, {
          contentType,
          upsert: true,
        });

      if (storageError) throw storageError;

      const newAvatarUrl = await getAvatarSignedUrl(fileNameInBucket);

      if (!newAvatarUrl) throw new Error("Gagal mendapatkan URL avatar.");

      // 2. Auto-Save to Database
      // Update Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { avatar_url: fileNameInBucket },
      });
      if (authError) throw authError;

      // Update Profile Table
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: fileNameInBucket })
        .eq("user_id", user.id);

      if (profileError) {
        // If update fails (e.g. row doesn't exist), try upsert
        if (__DEV__)
          console.error("Update failed, trying upsert for avatar...");
        await supabase.from("user_profiles").upsert(
          {
            user_id: user.id,
            avatar_url: fileNameInBucket,
            full_name: name || user.email, // Minimal required fields
          },
          { onConflict: "user_id" },
        );
      }

      // 3. Update Local State
      setAvatarPath(fileNameInBucket);
      setAvatarUrl(newAvatarUrl);
      await clearProfileCache();

      // Sync global auth store
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) setUser(userData.user);

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
              // Remove from Auth
              await supabase.auth.updateUser({ data: { avatar_url: null } });
              // Remove from Table
              await supabase
                .from("user_profiles")
                .update({ avatar_url: null })
                .eq("user_id", user?.id);

              setAvatarPath(null);
              setAvatarUrl(null);
              await clearProfileCache();

              const { data: userData } = await supabase.auth.getUser();
              if (userData?.user) setUser(userData.user);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        throw new Error("Sesi tidak valid.");
      }
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (reAuthError) {
        // Provide user-friendly error message for incorrect password
        if (
          reAuthError.message.toLowerCase().includes("invalid") ||
          reAuthError.message.toLowerCase().includes("incorrect") ||
          reAuthError.message.toLowerCase().includes("wrong")
        ) {
          throw new Error("Password lama yang Anda masukkan salah.");
        }
        throw new Error(
          reAuthError.message || "Gagal memverifikasi password lama.",
        );
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

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
      Alert.alert("Error", "Gagal mengubah password.");
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
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
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
            {enrollmentStatus === "loading" && (
              <View className="flex-row items-center py-2">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text className="text-muted-foreground ml-3">
                  Memeriksa status enrollment...
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
                  onPress={() => router.push("./enroll")}
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
                <Button
                  variant="outline"
                  size="default"
                  onPress={checkEnrollmentStatus}
                  className="w-full border-border"
                >
                  <Icon as={Loader2} className="size-5 text-foreground mr-2" />
                  <Text className="text-foreground font-semibold">
                    Coba Lagi
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
