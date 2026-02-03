import * as ImagePicker from "expo-image-picker";
import { useRouter, Stack, useNavigation } from "expo-router";
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
import axios, { isAxiosError } from "axios";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Avatar } from "~/components/ui/avatar";
import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import {
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Trash2,
  Eye,
  CheckCircle,
  AlertCircle,
  Scan,
  Loader2,
} from "lucide-react-native";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

// Define interface for user profile data
interface UserProfile {
  id: string;
  full_name?: string;
  email?: string;
  absence_number?: string;
  class_name?: string;
  nis?: string;
  gender?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Enrollment status types
type EnrollmentStatus = "loading" | "enrolled" | "not_enrolled" | "error";

interface EnrollmentStatusResponse {
  is_enrolled: boolean;
  embedding_count: number;
  user_id: string;
}

// Face API base URL
const FACE_API_BASE_URL = process.env.EXPO_PUBLIC_FACE_API_URL || "";
const ENROLL_STATUS_URL = `${FACE_API_BASE_URL}/v1/enroll/status`;

// Cache management utility
const PROFILE_CACHE_KEY = "user_profile_cache";

const clearProfileCache = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {}
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

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const navigation = useNavigation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [absenceNumber, setAbsenceNumber] = useState("");
  const [className, setClassName] = useState("");
  const [nis, setNis] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [fetchProfileError, setFetchProfileError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isAvatarOptionsVisible, setIsAvatarOptionsVisible] = useState(false);
  const [isViewAvatarVisible, setIsViewAvatarVisible] = useState(false);

  const [initialAbsenceNumber, setInitialAbsenceNumber] = useState("");
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);

  // Enrollment status state
  const [enrollmentStatus, setEnrollmentStatus] =
    useState<EnrollmentStatus>("loading");
  const [enrollmentError, setEnrollmentError] = useState<string>("");

  useEffect(() => {
    const fetchAndSetProfileData = async () => {
      if (!user) {
        return;
      }

      // Set loading indicator if needed

      // First try to fetch data from user_profiles table (primary source)
      try {
        // Implement retry mechanism for race condition
        const maxRetries = 3;
        let profileData = null;
        let fetchError = null;

        // Try multiple times with a delay to handle race conditions
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          const { data, error } = await supabase
            .from("user_profiles")
            .select(
              "full_name, email, absence_number, class_name, nis, gender, avatar_url",
            )
            .eq("user_id", user?.id)
            .single();

          if (data) {
            profileData = data;
            fetchError = null;
            break; // Exit loop if we got data
          }

          fetchError = error;

          // If error is something other than "not found", don't retry
          if (error && error.code !== "PGRST116") {
            break;
          }
        }

        if (fetchError && fetchError.code !== "PGRST116") {
          console.error("Error fetching profile:", fetchError.message);
          console.error("Error details:", fetchError);
          setFetchProfileError(true);
        }

        if (profileData) {
          // If we have profile data from database, use it as primary source
          setProfileData(profileData as UserProfile);

          // Prioritize profile data, fall back to user metadata only if needed
          const currentName =
            user.user_metadata?.name || user.user_metadata?.full_name || "";
          const currentEmail = user.email || "";
          const currentAbsenceNumber = user.user_metadata?.absence_number || "";
          const currentClassName = user.user_metadata?.class_name || "";
          const currentNis = user.user_metadata?.nis || "";
          const currentGender = user.user_metadata?.gender || "";
          const currentAvatarUrl = user.user_metadata?.avatar_url || null;

          setName(profileData.full_name || currentName);
          setEmail(profileData.email || currentEmail);
          setAbsenceNumber(profileData.absence_number || currentAbsenceNumber);
          setClassName(profileData.class_name || currentClassName);
          setNis(profileData.nis || currentNis);
          setGender(profileData.gender || currentGender);
          setAvatarUrl(profileData.avatar_url || currentAvatarUrl);

          // Set initial values for change detection
          setInitialAbsenceNumber(
            profileData.absence_number || currentAbsenceNumber,
          );
          setInitialAvatarUrl(profileData.avatar_url || currentAvatarUrl);
        } else {
          // Fallback to user metadata if no profile data
          let currentName =
            user.user_metadata?.name || user.user_metadata?.full_name || "";
          let currentEmail = user.email || "";
          let currentAbsenceNumber = user.user_metadata?.absence_number || "";
          let currentClassName = user.user_metadata?.class_name || "";
          let currentNis = user.user_metadata?.nis || "";
          let currentGender = user.user_metadata?.gender || "";
          let currentAvatarUrl: string | null =
            user.user_metadata?.avatar_url || null;

          // Set values from user metadata as fallback
          setName(currentName);
          setEmail(currentEmail);
          setAbsenceNumber(currentAbsenceNumber);
          setClassName(currentClassName);
          setNis(currentNis);
          setGender(currentGender);
          setAvatarUrl(currentAvatarUrl);
          setInitialAbsenceNumber(currentAbsenceNumber);
          setInitialAvatarUrl(currentAvatarUrl);
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setFetchProfileError(true);

        // Fallback to user metadata on error
        let currentName =
          user.user_metadata?.name || user.user_metadata?.full_name || "";
        let currentEmail = user.email || "";
        let currentAbsenceNumber = user.user_metadata?.absence_number || "";
        let currentClassName = user.user_metadata?.class_name || "";
        let currentNis = user.user_metadata?.nis || "";
        let currentGender = user.user_metadata?.gender || "";
        let currentAvatarUrl: string | null =
          user.user_metadata?.avatar_url || null;

        setName(currentName);
        setEmail(currentEmail);
        setAbsenceNumber(currentAbsenceNumber);
        setClassName(currentClassName);
        setNis(currentNis);
        setGender(currentGender);
        setAvatarUrl(currentAvatarUrl);
        setInitialAbsenceNumber(currentAbsenceNumber);
        setInitialAvatarUrl(currentAvatarUrl);
      }
    };

    fetchAndSetProfileData();
  }, [user]);
  // Check face enrollment status
  const checkEnrollmentStatus = async () => {
    if (!ENROLL_STATUS_URL) {
      setEnrollmentStatus("error");
      setEnrollmentError("URL API belum dikonfigurasi");
      return;
    }

    try {
      setEnrollmentStatus("loading");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setEnrollmentStatus("error");
        setEnrollmentError("Sesi tidak valid");
        return;
      }

      const response = await axios.get<EnrollmentStatusResponse>(
        ENROLL_STATUS_URL,
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
      console.error("Error checking enrollment status:", error);
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

  useEffect(() => {
    const onBeforeRemove = (e: any) => {
      const hasUnsavedChanges = avatarUrl !== initialAvatarUrl;

      if (!hasUnsavedChanges) {
        return;
      }

      e.preventDefault();

      Alert.alert(
        "Perubahan Belum Disimpan",
        "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
        [
          { text: "Tetap di Sini", style: "cancel", onPress: () => {} },
          {
            text: "Tinggalkan",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    };

    navigation.addListener("beforeRemove", onBeforeRemove);

    return () => {
      navigation.removeListener("beforeRemove", onBeforeRemove);
    };
  }, [navigation, avatarUrl, initialAvatarUrl]);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      // Allow navigation if user has any name data (profile, form, or auth metadata)
      const hasAnyName =
        (profileData?.full_name && profileData.full_name.trim().length > 0) ||
        (name && name.trim().length > 0) ||
        (user?.user_metadata?.name &&
          user.user_metadata.name.trim().length > 0) ||
        (user?.user_metadata?.full_name &&
          user.user_metadata.full_name.trim().length > 0);

      // Only prevent navigation if user truly has no name data anywhere
      if (!hasAnyName) {
        Alert.alert(
          "Profil Wajib Diisi",
          "Anda harus melengkapi profil terlebih dahulu sebelum dapat menggunakan aplikasi.",
          [{ text: "OK" }],
        );
        return true; // Prevent default behavior
      }

      // Handle unsaved changes
      const hasUnsavedChanges = avatarUrl !== initialAvatarUrl;

      if (hasUnsavedChanges) {
        Alert.alert(
          "Perubahan Belum Disimpan",
          "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
          [
            { text: "Tetap di Sini", style: "cancel" },
            {
              text: "Tinggalkan",
              style: "destructive",
              onPress: () => router.back(),
            },
          ],
        );
      } else {
        router.back();
      }
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [
    router,
    avatarUrl,
    initialAvatarUrl,
    profileData,
    name,
    user?.user_metadata?.name,
    user?.user_metadata?.full_name,
  ]);

  const pickImageFromGallery = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "We need permission to access your photos",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadAvatar(imageUri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const captureImageWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Kami membutuhkan izin kamera untuk mengambil foto profil.",
        );
        return;
      }

      setIsAvatarOptionsVisible(false);

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        await uploadAvatar(imageUri);
      }
    } catch (error) {
      console.error("Error capturing image:", error);
      Alert.alert("Error", "Gagal mengambil foto dari kamera");
    }
  };

  const handleChooseFromGallery = async () => {
    setIsAvatarOptionsVisible(false);
    await pickImageFromGallery();
  };

  const handleRemoveAvatar = () => {
    if (!avatarUrl) {
      Alert.alert(
        "Tidak Ada Foto",
        "Anda belum memiliki foto profil untuk dihapus.",
      );
      return;
    }

    setIsAvatarOptionsVisible(false);

    Alert.alert(
      "Hapus Foto Profil",
      "Foto profil akan dihapus setelah Anda menekan Simpan Perubahan. Lanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => {
            setAvatarUrl(null);
            Alert.alert(
              "Perlu Simpan",
              "Tekan Simpan Perubahan untuk menghapus foto profil sepenuhnya.",
            );
          },
        },
      ],
    );
  };

  const handleViewAvatar = () => {
    if (!avatarUrl) {
      Alert.alert(
        "Tidak Ada Foto",
        "Unggah foto profil terlebih dahulu untuk menampilkannya.",
      );
      return;
    }

    setIsAvatarOptionsVisible(false);
    setIsViewAvatarVisible(true);
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileNameInBucket = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const fileBytes = base64ToUint8Array(base64Data);

      const { data: storageData, error: storageError } = await supabase.storage
        .from("avatars")
        .upload(fileNameInBucket, fileBytes, {
          contentType,
          upsert: true,
        });

      if (storageError) {
        console.error("Supabase storage error details:", storageError);
        throw new Error(`Supabase storage error: ${storageError.message}`);
      }

      const { data: urlData, error: signedErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(fileNameInBucket, 60 * 60 * 24 * 7); // 7 days

      if (signedErr) {
        console.error("Failed to get signed URL. Storage data:", storageData);
        throw new Error(`Gagal mendapatkan URL avatar: ${signedErr.message}`);
      }

      const newAvatarUrl = urlData?.signedUrl;

      if (!newAvatarUrl) {
        console.error("Failed to get signed URL. Storage data:", storageData);
        throw new Error("Gagal mendapatkan URL avatar setelah unggah.");
      }

      setAvatarUrl(newAvatarUrl);
      Alert.alert(
        "Sukses",
        "Avatar berhasil diperbarui. Klik Simpan untuk menyimpan perubahan profil Anda.",
      );
    } catch (error) {
      console.error("Error in uploadAvatar function:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      Alert.alert("Gagal Unggah", `Gagal mengunggah avatar: ${errorMessage}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          avatar_url: avatarUrl,
        },
      });

      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }

      // Update absence_number and avatar_url in the profiles table using upsert
      // Use onConflict to specify which column to use for conflict resolution
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user?.id,
            absence_number: absenceNumber,
            class_name: className,
            avatar_url: avatarUrl,
            full_name:
              name ||
              user?.user_metadata?.name ||
              user?.user_metadata?.full_name,
            email: email,
            nis: nis,
            gender: gender,
          },
          {
            onConflict: "user_id",
          },
        );

      if (profileError) {
        console.error("Error updating profile table:", profileError);
        console.error("User ID:", user?.id);
        console.error("Profile data being saved:", {
          user_id: user?.id,
          absence_number: absenceNumber,
          avatar_url: avatarUrl,
          full_name: name,
          email: email,
        });
        Alert.alert(
          "Perhatian",
          "Profil berhasil diperbarui, tetapi ada masalah menyimpan data profil. Beberapa informasi mungkin tidak tersimpan dengan benar.",
          [{ text: "OK" }],
        );
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "Gagal mengambil data user terbaru");
        setLoading(false);
        return;
      }

      // Fetch refreshed profile data
      const { data: refreshedProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (refreshedProfile) {
        setProfileData(refreshedProfile);
      }
      setUser(userData.user);

      // Clear profile cache to ensure fresh data is loaded in other screens
      await clearProfileCache();

      setInitialAbsenceNumber(absenceNumber);
      setInitialAvatarUrl(avatarUrl);

      Alert.alert("Sukses", "Profil berhasil diperbarui", [
        {
          text: "OK",
          onPress: () => {
            // Navigate back to the previous screen
            router.back();
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Error", "Gagal memperbarui profil");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchProfileError && user) {
      console.warn(
        "Couldn't connect to profiles table. Table might not exist yet.",
      );
    }
  }, [fetchProfileError, user]);

  return (
    <SafeAreaView className={`flex-1 bg-background`}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className={`flex-row items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-card dark:bg-gray-800`}
      >
        <TouchableOpacity
          onPress={() => {
            // Allow navigation if user has any name data (profile, form, or auth metadata)
            const hasAnyName =
              (profileData?.full_name &&
                profileData.full_name.trim().length > 0) ||
              (name && name.trim().length > 0) ||
              (user?.user_metadata?.name &&
                user.user_metadata.name.trim().length > 0) ||
              (user?.user_metadata?.full_name &&
                user.user_metadata.full_name.trim().length > 0);

            // Only prevent navigation if user truly has no name data anywhere
            if (!hasAnyName) {
              Alert.alert(
                "Profil Wajib Diisi",
                "Anda harus melengkapi profil terlebih dahulu sebelum dapat menggunakan aplikasi.",
                [{ text: "OK" }],
              );
              return;
            }

            // Check for unsaved changes
            const hasUnsavedChanges =
              absenceNumber !== initialAbsenceNumber ||
              avatarUrl !== initialAvatarUrl;

            if (hasUnsavedChanges) {
              Alert.alert(
                "Perubahan Belum Disimpan",
                "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
                [
                  { text: "Tetap di Sini", style: "cancel" },
                  {
                    text: "Tinggalkan",
                    style: "destructive",
                    onPress: () => router.back(),
                  },
                ],
              );
            } else {
              router.back();
            }
          }}
          className="mr-3"
        >
          <Icon as={ChevronLeft} className="size-6 text-foreground" />
        </TouchableOpacity>

        <Text variant="h3" className="flex-1 text-foreground">
          Edit Profil
        </Text>
      </View>

      <ScrollView
        className={`flex-1`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Profile Section with Photo and Basic Info */}
        <View className="px-6 pt-6 pb-4">
          <Card
            className={`p-6 bg-card dark:bg-gray-800 border-gray-200 dark:border-gray-700`}
          >
            <View className="items-center">
              <Text variant="h3" className={`mb-6 text-foreground`}>
                Foto Profil
              </Text>

              <View className="relative mb-6">
                {uploadingAvatar ? (
                  <View
                    className={`w-32 h-32 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-700`}
                    style={{
                      shadowColor: "#000000",
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 8,
                    }}
                  >
                    <ActivityIndicator size="large" color={"#3b82f6"} />
                  </View>
                ) : (
                  <>
                    <View
                      style={{
                        shadowColor: "#000000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 8,
                        borderRadius: 64,
                      }}
                    >
                      <Avatar
                        source={avatarUrl || undefined}
                        fallback={
                          user?.user_metadata?.name?.charAt(0) ||
                          user?.email?.charAt(0) ||
                          "U"
                        }
                        size="lg"
                        className="w-32 h-32"
                      />
                    </View>

                    <TouchableOpacity
                      className="absolute bottom-0 right-0 bg-blue-500 dark:bg-blue-600 rounded-full p-3"
                      onPress={() => setIsAvatarOptionsVisible(true)}
                      disabled={uploadingAvatar}
                      style={{
                        shadowColor: "#3B82F6",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                        opacity: uploadingAvatar ? 0.6 : 1,
                      }}
                    >
                      <Icon as={Camera} className="size-5 text-white" />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <Modal
                visible={isAvatarOptionsVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsAvatarOptionsVisible(false)}
              >
                <View className="flex-1 justify-end">
                  <TouchableWithoutFeedback
                    onPress={() => setIsAvatarOptionsVisible(false)}
                  >
                    <View className="flex-1 bg-black/40" />
                  </TouchableWithoutFeedback>

                  <SafeAreaView
                    edges={["bottom"]}
                    className="bg-card dark:bg-gray-900 rounded-t-3xl px-6 pt-4 pb-6"
                  >
                    <View className="items-center">
                      <View className="w-12 h-1 rounded-full bg-muted mb-4" />
                      <Text variant="h3" className="text-foreground mb-6">
                        Foto Profil
                      </Text>

                      <View className="flex-row justify-between w-full">
                        <TouchableOpacity
                          className="items-center flex-1"
                          onPress={handleViewAvatar}
                          activeOpacity={0.85}
                          disabled={!avatarUrl}
                        >
                          <View
                            className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${avatarUrl ? "bg-blue-500/10 dark:bg-blue-500/20" : "bg-muted"}`}
                          >
                            <Icon
                              as={Eye}
                              className={`size-7 ${avatarUrl ? "text-blue-500" : "text-muted-foreground"}`}
                            />
                          </View>
                          <Text
                            variant="small"
                            className={`font-medium ${avatarUrl ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            Lihat Foto
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="items-center flex-1"
                          onPress={captureImageWithCamera}
                          activeOpacity={0.85}
                        >
                          <View className="w-14 h-14 rounded-full items-center justify-center mb-2 bg-blue-500/10 dark:bg-blue-500/20">
                            <Icon
                              as={Camera}
                              className="size-7 text-blue-500"
                            />
                          </View>
                          <Text
                            variant="small"
                            className="font-medium text-foreground"
                          >
                            Kamera
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="items-center flex-1"
                          onPress={handleChooseFromGallery}
                          activeOpacity={0.85}
                        >
                          <View className="w-14 h-14 rounded-full items-center justify-center mb-2 bg-blue-500/10 dark:bg-blue-500/20">
                            <Icon
                              as={ImageIcon}
                              className="size-7 text-blue-500"
                            />
                          </View>
                          <Text
                            variant="small"
                            className="font-medium text-foreground"
                          >
                            Galeri
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="items-center flex-1"
                          onPress={handleRemoveAvatar}
                          activeOpacity={0.85}
                          disabled={!avatarUrl}
                        >
                          <View
                            className={`w-14 h-14 rounded-full items-center justify-center mb-2 ${avatarUrl ? "bg-red-500/10" : "bg-muted"}`}
                          >
                            <Icon
                              as={Trash2}
                              className={`size-7 ${avatarUrl ? "text-red-500" : "text-muted-foreground"}`}
                            />
                          </View>
                          <Text
                            variant="small"
                            className={`font-medium ${avatarUrl ? "text-red-500" : "text-muted-foreground"}`}
                          >
                            Hapus
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        onPress={() => setIsAvatarOptionsVisible(false)}
                        className="mt-6 w-full py-3 rounded-full bg-muted items-center"
                        activeOpacity={0.75}
                      >
                        <Text variant="default" className="text-foreground">
                          Batal
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </SafeAreaView>
                </View>
              </Modal>
              <Modal
                visible={isViewAvatarVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsViewAvatarVisible(false)}
              >
                <TouchableWithoutFeedback
                  onPress={() => setIsViewAvatarVisible(false)}
                >
                  <View className="flex-1 bg-black/90 items-center justify-center">
                    {avatarUrl ? (
                      <View className="w-64 h-64 rounded-full overflow-hidden border-4 border-white/20">
                        <RNImage
                          source={{ uri: avatarUrl }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <Text className="text-white">
                        Foto profil tidak tersedia.
                      </Text>
                    )}
                  </View>
                </TouchableWithoutFeedback>
              </Modal>
              <Text
                variant={"small"}
                className={`text-center text-muted-foreground`}
              >
                Ketuk ikon kamera untuk mengubah foto profil
              </Text>
            </View>
          </Card>
        </View>

        {/* Combined Information Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 dark:bg-gray-800 border-gray-200 dark:border-gray-700`}
          >
            <Text variant="h3" className={`mb-3 text-foreground`}>
              Informasi Pribadi
            </Text>

            <View className="space-y-3">
              <View>
                <Text
                  variant="small"
                  className={`font-medium mb-1 text-foreground`}
                >
                  Nama Lengkap
                </Text>
                <Input
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  editable={false} // added: make read-only
                  className={"border-gray-300 bg-white"}
                />
              </View>

              <View>
                <Text
                  variant="small"
                  className={`font-medium mb-1 text-foreground`}
                >
                  Email
                </Text>
                <Input
                  placeholder="Masukkan alamat email"
                  value={email}
                  editable={false}
                  className={"border-gray-300 bg-white"}
                  accessibilityHint="Email address, read-only"
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Academic Information Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 dark:bg-gray-800 border-gray-200 dark:border-gray-700`}
          >
            <Text variant="h3" className={`mb-3 text-foreground`}>
              Informasi Akademik
            </Text>

            <View className="space-y-3">
              <View>
                <Text
                  variant={"small"}
                  className={`font-medium mb-1 text-foreground`}
                >
                  Nomor Absen
                </Text>
                <Input
                  placeholder="Masukkan nomor absen"
                  value={absenceNumber}
                  editable={false} // added: make read-only
                  keyboardType="numeric"
                  className={"border-gray-300 bg-white"}
                />
              </View>

              <View>
                <Text
                  variant={"small"}
                  className={`font-medium mb-1 text-foreground`}
                >
                  Kelas
                </Text>
                <Input
                  placeholder="Masukkan kelas"
                  value={className}
                  editable={false} // added: make read-only
                  className={"border-gray-300 bg-white"}
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Face Enrollment Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 dark:bg-gray-800 border-gray-200 dark:border-gray-700`}
          >
            <Text variant="h3" className={`mb-3 text-foreground`}>
              Verifikasi Wajah
            </Text>

            {enrollmentStatus === "loading" && (
              <View className="flex-row items-center py-2">
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text variant="default" className="text-muted-foreground ml-3">
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
                  <Text
                    variant="default"
                    className="text-foreground font-medium"
                  >
                    Wajah Sudah Terdaftar
                  </Text>
                  <Text variant="small" className="text-muted-foreground">
                    Data wajah Anda tersimpan untuk verifikasi absensi
                  </Text>
                </View>
              </View>
            )}

            {enrollmentStatus !== "not_enrolled" && (
              <View>
                <View className="flex-row items-center py-2 mb-3">
                  <View className="w-10 h-10 rounded-full bg-amber-500/20 items-center justify-center">
                    <Icon as={AlertCircle} className="size-6 text-amber-600" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text
                      variant="default"
                      className="text-foreground font-medium"
                    >
                      Wajah Belum Terdaftar
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      Daftarkan wajah untuk mengaktifkan fitur absensi
                    </Text>
                  </View>
                </View>
                <Button
                  variant="default"
                  size="default"
                  onPress={() => router.push("./enroll")}
                  className="w-full bg-blue-500"
                >
                  <Icon as={Scan} className="size-5 text-white mr-2" />
                  <Text className="text-white font-medium">
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
                    <Text
                      variant="default"
                      className="text-foreground font-medium"
                    >
                      Gagal Memeriksa Status
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      {enrollmentError || "Terjadi kesalahan"}
                    </Text>
                  </View>
                </View>
                <Button
                  variant="outline"
                  size="default"
                  onPress={checkEnrollmentStatus}
                  className="w-full border-gray-300 dark:border-gray-600"
                >
                  <Icon as={Loader2} className="size-5 text-foreground mr-2" />
                  <Text className="text-foreground font-medium">Coba Lagi</Text>
                </Button>
              </View>
            )}
          </Card>
        </View>

        {/* Action Buttons Section */}
        <View className="px-6">
          <Card
            className={`p-4 dark:bg-gray-800 border-gray-200 dark:border-gray-700`}
          >
            <Button
              variant="default"
              size="default"
              disabled={loading}
              onPress={handleSave}
              className="mb-3 w-full bg-blue-500"
            >
              {loading ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                    style={{ marginRight: 8 }}
                  />
                  <Text className="text-white font-medium">
                    Sedang menyimpan...
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-medium">Simpan Perubahan</Text>
              )}
            </Button>

            <Button
              variant="outline"
              size="default"
              onPress={() => router.back()}
              disabled={loading}
              className={`w-full border-gray-300 dark:border-gray-600 bg-transparent`}
            >
              <Text className={"text-foreground font-medium"}>Batal</Text>
            </Button>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
