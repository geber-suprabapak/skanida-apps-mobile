import * as ImagePicker from "expo-image-picker";
import { useRouter, Stack, useNavigation } from "expo-router";
import React, { useState, useEffect } from "react";
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
import { Text } from "~/components/ui/text";
import { Avatar } from "~/components/ui/avatar";
import { H3, Small } from "~/components/ui/typography";
import useAuthStore from "~/store/authStore";
import { useColorScheme } from "~/lib/useColorScheme";
import { supabase } from "~/utils/supabase";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Camera } from "~/lib/icons/Camera";
import { Card } from "~/components/ui/card";

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

  const [initialAbsenceNumber, setInitialAbsenceNumber] = useState("");
  const [initialAvatarUrl, setInitialAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndSetProfileData = async () => {
      if (!user) {
        return;
      }

      // Set loading indicator if needed

      // First try to fetch data from user_profiles table (primary source)
      try {
        console.log("Fetching profile for user id:", user?.id);

        // Implement retry mechanism for race condition
        const maxRetries = 3;
        let profileData = null;
        let fetchError = null;

        // Try multiple times with a delay to handle race conditions
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 500));
            console.log(`Retry attempt ${attempt + 1} for profile data...`);
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
          console.log("Profile data found:", profileData);
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

          console.log("Data set from user_profiles:", {
            name: profileData.full_name,
            nis: profileData.nis,
            gender: profileData.gender,
            className: profileData.class_name,
            absenceNumber: profileData.absence_number,
          });
        } else {
          console.log("No profile data found for user:", user.id);

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

          console.log("Using fallback data from user metadata");
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

      console.log("Hardware back button check:", {
        hasAnyName,
        profileDataFullName: profileData?.full_name,
        formName: name,
        userMetadataName: user?.user_metadata?.name,
        userMetadataFullName: user?.user_metadata?.full_name,
      });

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
    setLoading(true);
    try {
      // Only update the avatar_url in user metadata (absence number is read-only)
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
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert({
          user_id: user?.id,
          absence_number: absenceNumber,
          avatar_url: avatarUrl,
          full_name:
            name || user?.user_metadata?.name || user?.user_metadata?.full_name,
          email: email,
          class_name: className,
          nis: nis,
          gender: gender,
        });

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
            // Allow navigation if user has any name data (profile, form, or auth metadata)
            const hasAnyName =
              (profileData?.full_name &&
                profileData.full_name.trim().length > 0) ||
              (name && name.trim().length > 0) ||
              (user?.user_metadata?.name &&
                user.user_metadata.name.trim().length > 0) ||
              (user?.user_metadata?.full_name &&
                user.user_metadata.full_name.trim().length > 0);

            console.log("Header back button check:", {
              hasAnyName,
              profileDataFullName: profileData?.full_name,
              formName: name,
              userMetadataName: user?.user_metadata?.name,
              userMetadataFullName: user?.user_metadata?.full_name,
            });

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
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {name || "Belum diisi"}
                  </Text>
                </View>
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Email
                </Small>
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {email || "Belum diisi"}
                  </Text>
                </View>
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  NIS
                </Small>
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {nis || "Belum diisi"}
                  </Text>
                </View>
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
                  Kelas
                </Small>
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {className || "Belum diisi"}
                  </Text>
                </View>
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Jenis Kelamin
                </Small>
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {gender
                      ? gender === "male"
                        ? "Laki-laki"
                        : "Perempuan"
                      : "Belum diisi"}
                  </Text>
                </View>
              </View>

              <View>
                <Small
                  className={`font-medium mb-1 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nomor Absen
                </Small>
                <View
                  className={`px-3 py-3 rounded-lg border ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-gray-300 bg-gray-100"
                  }`}
                >
                  <Text
                    className={`${
                      isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {absenceNumber || "Belum diisi"}
                  </Text>
                </View>
                <Small
                  className={`mt-1 ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  *Tidak dapat diubah
                </Small>
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
