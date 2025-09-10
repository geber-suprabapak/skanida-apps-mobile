import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter, Stack, useNavigation } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Avatar } from "~/components/ui/avatar";
import { H3, P, Small, Muted } from "~/components/ui/typography";
import useAuthStore from "~/store/authStore";
import { useColorScheme } from "~/lib/useColorScheme";
import { userProfilesService } from "~/utils/migration/databaseMigration";
import { account } from "~/utils/appwrite";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { User } from "~/lib/icons/User";
import { Camera } from "~/lib/icons/Camera";
import { Card } from "~/components/ui/card";

// Define interface for user profile data (Appwrite format)
interface UserProfile {
  $id: string;
  user_id: string;
  full_name?: string;
  email?: string;
  absence_number?: string;
  class_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

// Cache management utility
const PROFILE_CACHE_KEY = "user_profile_cache";

const clearProfileCache = async () => {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (error) {
    console.log("Failed to clear profile cache:", error);
  }
};

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const { isDarkColorScheme } = useColorScheme();
  const router = useRouter();
  const navigation = useNavigation();

  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [absenceNumber, setAbsenceNumber] = useState(
    user?.user_metadata?.absence_number || "",
  );
  const [className, setClassName] = useState(
    user?.user_metadata?.class_name || "",
  );
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [fetchProfileError, setFetchProfileError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [initialName, setInitialName] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [initialAbsenceNumber, setInitialAbsenceNumber] = useState("");
  const [initialClassName, setInitialClassName] = useState("");
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetInitialProfileData = async () => {
      if (!user) {
        setInitialName(name);
        setInitialEmail(email);
        setInitialAbsenceNumber(absenceNumber);
        setInitialClassName(className);
        setInitialAvatarUrl(avatarUrl);
        return;
      }

      let currentName = user?.name || "";
      let currentEmail = user?.email || "";
      let currentAbsenceNumber = "";
      let currentClassName = "";
      let currentAvatarUrl: string | null = null;

      setEmail(currentEmail);

      try {
        const result = await userProfilesService.getProfile(user?.$id || "");

        if (!result.success && result.message !== "Profile not found") {
          console.error("Error fetching profile:", result.message);
          setFetchProfileError(true);
        }

        if (result.success && result.data) {
          setProfileData(result.data as UserProfile);
          currentName = result.data.full_name || currentName;
          currentAbsenceNumber = result.data.absence_number || currentAbsenceNumber;
          currentClassName = result.data.class_name || currentClassName;
          currentAvatarUrl = result.data.avatar_url || currentAvatarUrl;
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setFetchProfileError(true);
      }

      setName(currentName);
      setInitialName(currentName);
      setInitialEmail(currentEmail);
      setAbsenceNumber(currentAbsenceNumber);
      setInitialAbsenceNumber(currentAbsenceNumber);
      setClassName(currentClassName);
      setInitialClassName(currentClassName);
      setAvatarUrl(currentAvatarUrl);
      setInitialAvatarUrl(currentAvatarUrl);
    };

    fetchAndSetInitialProfileData();
  }, [user]);
  useEffect(() => {
    const onBeforeRemove = (e: any) => {
      const hasUnsavedChanges =
        name !== initialName ||
        email !== initialEmail ||
        absenceNumber !== initialAbsenceNumber ||
        className !== initialClassName ||
        avatarUrl !== initialAvatarUrl;

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
  }, [
    navigation,
    name,
    email,
    absenceNumber,
    className,
    avatarUrl,
    initialName,
    initialEmail,
    initialAbsenceNumber,
    initialClassName,
    initialAvatarUrl,
  ]);

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      // Check if profile is required (by checking if name is empty)
      const isProfileRequired = !profileData?.full_name && !name;

      // If profile is required (empty), prevent going back
      if (isProfileRequired) {
        Alert.alert(
          "Profil Wajib Diisi",
          "Anda harus melengkapi profil terlebih dahulu sebelum dapat menggunakan aplikasi.",
          [{ text: "OK" }],
        );
        return true; // Prevent default behavior
      }

      // Handle unsaved changes
      const hasUnsavedChanges =
        name !== initialName ||
        email !== initialEmail ||
        absenceNumber !== initialAbsenceNumber ||
        className !== initialClassName ||
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
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [
    router,
    name,
    email,
    absenceNumber,
    className,
    avatarUrl,
    initialName,
    initialEmail,
    initialAbsenceNumber,
    initialClassName,
    initialAvatarUrl,
    profileData,
  ]);

  const pickImage = async () => {
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

  const uploadAvatar = async (uri: string) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileNameInBucket = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === "jpg" ? "jpeg" : fileExt}`;

      const formData = new FormData();
      formData.append("file", {
        uri: uri,
        name: fileNameInBucket,
        type: contentType,
      } as any);

      const { data: storageData, error: storageError } = await supabase.storage
        .from("avatars")
        .upload(fileNameInBucket, formData, {
          contentType: contentType,
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
    if (!name) {
      Alert.alert("Error", "Nama tidak boleh kosong");
      return;
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      Alert.alert("Error", "Email tidak valid");
      return;
    }

    setLoading(true);
    try {
      // Update email in Appwrite account if it has changed
      if (email !== user?.email) {
        try {
          await account.updateEmail(email, ""); // In Appwrite, password is required for email update
          Alert.alert(
            "Info", 
            "Email berhasil diperbarui. Anda mungkin perlu memverifikasi email baru."
          );
        } catch (emailError: any) {
          console.error("Error updating email:", emailError);
          // Continue with profile update even if email update fails
          Alert.alert(
            "Perhatian", 
            "Gagal memperbarui email, tetapi profil lainnya akan tetap disimpan."
          );
        }
      }

      // Update or create user profile in database
      const result = await userProfilesService.upsertProfile({
        user_id: user?.$id || "",
        full_name: name,
        email,
        absence_number: absenceNumber,
        class_name: className,
        avatar_url: avatarUrl,
      });

      if (!result.success) {
        Alert.alert("Error", result.message || "Gagal menyimpan profil");
        setLoading(false);
        return;
      }

      // Get updated user data from Appwrite
      try {
        const updatedUser = await account.get();
        setUser(updatedUser);
      } catch (userError) {
        console.error("Error getting updated user:", userError);
      }

      // Get updated profile data
      const updatedProfileResult = await userProfilesService.getProfile(user?.$id || "");
      if (updatedProfileResult.success && updatedProfileResult.data) {
        setProfileData(updatedProfileResult.data);
      }

      // Clear profile cache to ensure fresh data is loaded in other screens
      await clearProfileCache();

      setInitialName(name);
      setInitialEmail(email);
      setInitialAbsenceNumber(absenceNumber);
      setInitialClassName(className);
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
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className={`flex-row items-center p-4 border-b ${
          isDarkColorScheme
            ? "border-gray-700 bg-gray-900"
            : "border-gray-200 bg-white"
        }`}
      >
        <TouchableOpacity
          onPress={() => {
            // Check if profile is required (by checking if name is empty)
            const isProfileRequired = !profileData?.full_name && !name;

            // If profile is required (empty), prevent going back
            if (isProfileRequired) {
              Alert.alert(
                "Profil Wajib Diisi",
                "Anda harus melengkapi profil terlebih dahulu sebelum dapat menggunakan aplikasi.",
                [{ text: "OK" }],
              );
              return;
            }

            // Check for unsaved changes
            const hasUnsavedChanges =
              name !== initialName ||
              email !== initialEmail ||
              absenceNumber !== initialAbsenceNumber ||
              className !== initialClassName ||
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
          <ChevronLeft
            size={24}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
        </TouchableOpacity>

        <Text
          className={`text-lg font-bold flex-1 ${
            isDarkColorScheme ? "text-white" : "text-gray-900"
          }`}
        >
          Edit Profil
        </Text>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-gray-50"}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {/* Profile Section with Photo and Basic Info */}
        <View className="px-6 pt-6 pb-4">
          <Card
            className={`p-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <View className="items-center">
              <H3
                className={`mb-6 ${
                  isDarkColorScheme ? "text-white" : "text-gray-900"
                }`}
              >
                Foto Profil
              </H3>

              <View className="relative mb-6">
                {uploadingAvatar ? (
                  <View
                    className={`w-32 h-32 rounded-full items-center justify-center ${
                      isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"
                    }`}
                    style={{
                      shadowColor: "#000000",
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 8,
                    }}
                  >
                    <ActivityIndicator
                      size="large"
                      color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
                    />
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
                      className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-3"
                      onPress={pickImage}
                      style={{
                        shadowColor: "#3B82F6",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 6,
                      }}
                    >
                      <Camera size={18} color="#ffffff" />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <Small
                className={`text-center ${
                  isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Ketuk ikon kamera untuk mengubah foto profil
              </Small>
            </View>
          </Card>
        </View>

        {/* Combined Information Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <H3
              className={`mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Informasi Pribadi
            </H3>

            <View className="space-y-3">
              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nama Lengkap
                </Small>
                <Input
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  onChangeText={setName}
                  className={
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                      : "border-gray-300 bg-white"
                  }
                />
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Email
                </Small>
                <Input
                  placeholder="Masukkan alamat email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className={
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                      : "border-gray-300 bg-white"
                  }
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Academic Information Section */}
        <View className="px-6 mb-3">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <H3
              className={`mb-3 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Informasi Akademik
            </H3>

            <View className="space-y-3">
              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nomor Absen
                </Small>
                <Input
                  placeholder="Masukkan nomor absen"
                  value={absenceNumber}
                  onChangeText={setAbsenceNumber}
                  keyboardType="numeric"
                  className={
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                      : "border-gray-300 bg-white"
                  }
                />
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Kelas
                </Small>
                <Input
                  placeholder="Masukkan kelas"
                  value={className}
                  onChangeText={setClassName}
                  className={
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                      : "border-gray-300 bg-white"
                  }
                />
              </View>
            </View>
          </Card>
        </View>

        {/* Action Buttons Section */}
        <View className="px-6">
          <Card
            className={`p-4 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Button
              variant="default"
              size="default"
              disabled={loading}
              onPress={handleSave}
              className="mb-3 w-full bg-blue-500 hover:bg-blue-600"
              style={{
                shadowColor: "#3B82F6",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 3,
              }}
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
              className={`w-full ${
                isDarkColorScheme
                  ? "border-gray-600 bg-transparent"
                  : "border-gray-300 bg-transparent"
              }`}
            >
              <Text
                className={
                  isDarkColorScheme
                    ? "text-gray-300 font-medium"
                    : "text-gray-700 font-medium"
                }
              >
                Batal
              </Text>
            </Button>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
