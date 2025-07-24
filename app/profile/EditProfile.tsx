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
  Image,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import { useColorScheme } from "~/lib/useColorScheme";
import { supabase } from "~/utils/supabase";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { User } from "~/lib/icons/User";
import { Camera } from "~/lib/icons/Camera";
import { Card } from "~/components/ui/card";

// Define interface for user profile data
interface UserProfile {
  id: string;
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

      let currentName = user.user_metadata?.name || "";
      let currentEmail = user.email || "";
      let currentAbsenceNumber = user.user_metadata?.absence_number || "";
      let currentClassName = user.user_metadata?.class_name || "";
      let currentAvatarUrl: string | null =
        user.user_metadata?.avatar_url || null;

      setEmail(currentEmail);

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("full_name, email, absence_number, class_name, avatar_url")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching profile:", error.message);
          setFetchProfileError(true);
        }

        if (data) {
          setProfileData(data as UserProfile);
          currentName = data.full_name || currentName;
          currentAbsenceNumber = data.absence_number || currentAbsenceNumber;
          currentClassName = data.class_name || currentClassName;
          currentAvatarUrl = data.avatar_url || currentAvatarUrl;
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

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileNameInBucket);

      const newAvatarUrl = urlData?.publicUrl;

      if (!newAvatarUrl) {
        console.error("Failed to get public URL. Storage data:", storageData);
        throw new Error("Gagal mendapatkan URL publik avatar setelah unggah.");
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
      const { error: emailError } = await supabase.auth.updateUser({
        email,
      });

      if (emailError) {
        Alert.alert("Error", emailError.message);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          name,
          full_name: name,
          absence_number: absenceNumber,
          class_name: className,
          display_name: name,
          avatar_url: avatarUrl,
        },
      });

      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: name,
            email,
            absence_number: absenceNumber,
            class_name: className,
            avatar_url: avatarUrl,
          },
          { onConflict: "user_id" },
        );

      if (profileError) {
        console.error("Error updating profile table:", profileError);
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

      const { data: refreshedProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (refreshedProfile) {
        setProfileData(refreshedProfile);
      }
      setUser(userData.user);

      // Clear profile cache to ensure fresh data is loaded in other screens
      await clearProfileCache();

      setInitialName(name);
      setInitialEmail(email);
      setInitialAbsenceNumber(absenceNumber);
      setInitialClassName(className);
      setInitialAvatarUrl(avatarUrl);

      Alert.alert("Sukses", "Profil berhasil diperbarui", [
        { text: "OK", onPress: () => router.back() },
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
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ChevronLeft
            size={24}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
        </TouchableOpacity>
        <User
          size={24}
          color={isDarkColorScheme ? "#ffffff" : "#000000"}
          className="mr-3"
        />
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
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture Section */}
        <View className="px-6 pt-6 pb-4">
          <Card
            className={`p-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <View className="items-center">
              <Text
                className={`text-lg font-semibold mb-4 ${
                  isDarkColorScheme ? "text-white" : "text-gray-900"
                }`}
              >
                Foto Profil
              </Text>
              
              <View className="relative mb-4">
                {uploadingAvatar ? (
                  <View
                    className={`w-32 h-32 rounded-full items-center justify-center ${
                      isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"
                    }`}
                    style={{
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 4,
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
                        shadowColor: '#000000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 4,
                        borderRadius: 64,
                      }}
                    >
                      {avatarUrl ? (
                        <Image
                          source={{ uri: avatarUrl }}
                          className="w-32 h-32 rounded-full"
                        />
                      ) : (
                        <View
                          className={`w-32 h-32 rounded-full items-center justify-center ${
                            isDarkColorScheme ? "bg-gray-700" : "bg-gray-100"
                          }`}
                        >
                          <User
                            size={48}
                            color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                          />
                        </View>
                      )}
                    </View>
                    
                    <TouchableOpacity
                      className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-3"
                      onPress={pickImage}
                      style={{
                        shadowColor: '#3B82F6',
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

              <Text
                className={`text-sm text-center ${
                  isDarkColorScheme ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Ketuk ikon kamera untuk mengubah foto profil
              </Text>
            </View>
          </Card>
        </View>

        {/* Personal Information Section */}
        <View className="px-6 mb-6">
          <Card
            className={`p-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Informasi Pribadi
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nama Lengkap
                </Text>
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
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Email
                </Text>
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
        <View className="px-6 mb-6">
          <Card
            className={`p-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-lg font-semibold mb-4 ${
                isDarkColorScheme ? "text-white" : "text-gray-900"
              }`}
            >
              Informasi Akademik
            </Text>
            
            <View className="space-y-4">
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nomor Absen
                </Text>
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
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Kelas
                </Text>
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
            className={`p-6 ${
              isDarkColorScheme
                ? "bg-gray-800 border-gray-700"
                : "bg-white border-gray-200"
            }`}
          >
            <Button
              variant="default"
              size="lg"
              disabled={loading}
              onPress={handleSave}
              className="mb-3 w-full bg-blue-500 hover:bg-blue-600"
              style={{
                shadowColor: '#3B82F6',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
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
                <Text className="text-white font-medium">
                  Simpan Perubahan
                </Text>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="lg"
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
