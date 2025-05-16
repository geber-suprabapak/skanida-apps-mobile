import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { useRouter, Stack, useNavigation } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

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

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();

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
    const fetchProfile = async () => {
      if (user) {
        setLoading(true);
        try {
          // Fetch from user_profiles first
          const { data: profileData, error: profileError } = await supabase
            .from("user_profiles")
            .select("full_name, email, avatar_url, absence_number, class_name")
            .eq("user_id", user.id)
            .single();

          if (profileError && profileError.code !== "PGRST116") {
            console.error("Error fetching profile from DB:", profileError);
            Alert.alert("Error", "Gagal memuat profil.");
            setLoading(false);
            return;
          }

          // Use DB data if available, otherwise fallback to auth metadata or defaults
          const currentName = profileData?.full_name || user.user_metadata?.name || "";
          const currentEmail = profileData?.email || user.email || "";
          const currentAvatarUrl = profileData?.avatar_url || user.user_metadata?.avatar_url || "";
          const currentAbsenceNumber = profileData?.absence_number?.toString() || user.user_metadata?.absence_number?.toString() || "";
          const currentClassName = profileData?.class_name || user.user_metadata?.class_name || "";

          setName(currentName);
          setEmail(currentEmail);
          setAvatarUrl(currentAvatarUrl);
          setAbsenceNumber(currentAbsenceNumber);
          setClassName(currentClassName);

          setInitialName(currentName);
          setInitialEmail(currentEmail);
          setInitialAvatarUrl(currentAvatarUrl);
          setInitialAbsenceNumber(currentAbsenceNumber);
          setInitialClassName(currentClassName);

        } catch (error) {
          console.error("Error in fetchProfile:", error);
          Alert.alert("Error", "Terjadi kesalahan saat memuat profil.");
        } finally {
          setLoading(false);
        }
      }
    };

    if (isFocused && user) {
      fetchProfile();
    }
  }, [user, isFocused]);

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
        ]
      );
    };

    navigation.addListener('beforeRemove', onBeforeRemove);

    return () => {
      navigation.removeListener('beforeRemove', onBeforeRemove);
    };
  }, [navigation, name, email, absenceNumber, className, avatarUrl, initialName, initialEmail, initialAbsenceNumber, initialClassName, initialAvatarUrl]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos');
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
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (uri: string) => {
    if (!user) return;

    setUploadingAvatar(true);

    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileNameInBucket = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        name: fileNameInBucket,
        type: contentType,
      } as any);

      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('avatars')
        .upload(fileNameInBucket, formData, {
          contentType: contentType,
          upsert: true,
        });

      if (storageError) {
        console.error('Supabase storage error details:', storageError);
        throw new Error(`Supabase storage error: ${storageError.message}`);
      }

      const { data: urlData } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(fileNameInBucket);

      const newAvatarUrl = urlData?.publicUrl;

      if (!newAvatarUrl) {
        console.error('Failed to get public URL. Storage data:', storageData);
        throw new Error('Gagal mendapatkan URL publik avatar setelah unggah.');
      }

      setAvatarUrl(newAvatarUrl);
      Alert.alert('Sukses', 'Avatar berhasil diperbarui. Klik Simpan untuk menyimpan perubahan profil Anda.');

    } catch (error) {
      console.error('Error in uploadAvatar function:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Gagal Unggah', `Gagal mengunggah avatar: ${errorMessage}`);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert("Error", "User not found. Please re-login.");
      return;
    }
    setLoading(true);

    let metadataUpdates: { [key: string]: any } = {};
    let profileUpdates: { [key: string]: any } = {};
    let emailChanged = false;

    // Handle email change
    if (email && email !== initialEmail) {
      emailChanged = true;
      profileUpdates.email = email; // Update in user_profiles
    }

    // Prepare profile updates for user_profiles table
    if (name !== initialName) profileUpdates.full_name = name;
    if (avatarUrl !== initialAvatarUrl) profileUpdates.avatar_url = avatarUrl;
    if (absenceNumber !== initialAbsenceNumber) {
      profileUpdates.absence_number = absenceNumber ? parseInt(absenceNumber, 10) : null;
    }
    if (className !== initialClassName) {
      profileUpdates.class_name = className === "" ? null : className; // Store null if empty string
    }

    // Prepare metadata updates for auth.users.user_metadata
    const currentAuthMetadata = user.user_metadata || {};

    if (name && name !== currentAuthMetadata.name) {
      metadataUpdates.name = name;
    }

    if (avatarUrl !== currentAuthMetadata.avatar_url) {
      metadataUpdates.avatar_url = avatarUrl;
    }

    const formAbsenceNumStr = absenceNumber;
    const currentMetaAbsenceNum = currentAuthMetadata.absence_number;
    if (formAbsenceNumStr) {
      const formAbsenceNum = parseInt(formAbsenceNumStr, 10);
      if (!isNaN(formAbsenceNum) && formAbsenceNum !== currentMetaAbsenceNum) {
        metadataUpdates.absence_number = formAbsenceNum;
      }
    } else if (formAbsenceNumStr === "" && currentMetaAbsenceNum !== null && currentMetaAbsenceNum !== undefined) {
      metadataUpdates.absence_number = null;
    }

    const formClassNameStr = className; 
    const currentMetaClassName = currentAuthMetadata.class_name;

    if (formClassNameStr !== undefined) { // Check if className state itself is defined
      if (formClassNameStr === "") {
        // If input is empty string, set metadata to null if it wasn't already null/undefined
        if (currentMetaClassName !== null && currentMetaClassName !== undefined) {
          metadataUpdates.class_name = null;
        }
      } else {
        // If input has a value, update if it's different from metadata
        if (formClassNameStr !== currentMetaClassName) {
          metadataUpdates.class_name = formClassNameStr;
        }
      }
    }

    try {
      // 1. Update email in auth.users if changed
      if (emailChanged && email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });
        if (emailError) {
          throw new Error(`Gagal memperbarui email: ${emailError.message}`);
        }
      }

      // 2. Update user_profiles table
      if (Object.keys(profileUpdates).length > 0) {
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update(profileUpdates)
          .eq("user_id", user.id);
        if (profileError) {
          throw new Error(
            `Gagal memperbarui profil pengguna: ${profileError.message}`,
          );
        }
      }

      // 3. Update Supabase Auth user_metadata if there are changes
      if (Object.keys(metadataUpdates).length > 0) {
        const { data: userAuthUpdateData, error: userMetadataError } =
          await supabase.auth.updateUser({
            data: metadataUpdates,
          });

        if (userMetadataError) {
          console.error(
            "EditProfile: Error updating user metadata in Supabase Auth:",
            userMetadataError.message,
          );
          Alert.alert("Error", `Gagal memperbarui metadata pengguna: ${userMetadataError.message}`);
        }
      }

      // 4. Refresh user state in store
      const { data: refreshedSessionData, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("EditProfile: Error refreshing session:", refreshError.message);
        const { data: directUserData, error: directUserError } = await supabase.auth.getUser();
        if (directUserData.user) {
            setUser(directUserData.user);
        } else {
            console.error("EditProfile: Failed to get user directly after session refresh error:", directUserError?.message);
        }
      } else if (refreshedSessionData.user) {
        const { data: latestUserProfile, error: latestProfileError } =
          await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", refreshedSessionData.user.id)
            .single();

        if (latestProfileError && latestProfileError.code !== "PGRST116") {
          console.error("EditProfile: Error fetching latest user_profile post-save:", latestProfileError.message);
          setUser(refreshedSessionData.user);
        } else if (latestUserProfile) {
          const finalUserMetadata = { ...refreshedSessionData.user.user_metadata };
          finalUserMetadata.name = latestUserProfile.full_name ?? finalUserMetadata.name;
          finalUserMetadata.avatar_url = latestUserProfile.avatar_url ?? finalUserMetadata.avatar_url;
          finalUserMetadata.absence_number = latestUserProfile.absence_number ?? finalUserMetadata.absence_number;
          finalUserMetadata.class_name = latestUserProfile.class_name ?? finalUserMetadata.class_name;

          const updatedAuthUser = {
            ...refreshedSessionData.user,
            user_metadata: finalUserMetadata,
          };
          setUser(updatedAuthUser);

          setInitialName(latestUserProfile.full_name || "");
          setInitialEmail(refreshedSessionData.user.email || "");
          setInitialAbsenceNumber(latestUserProfile.absence_number?.toString() || "");
          setInitialClassName(latestUserProfile.class_name || "");
          setInitialAvatarUrl(latestUserProfile.avatar_url || null);
        } else {
          setUser(refreshedSessionData.user);
          setInitialName(refreshedSessionData.user.user_metadata.name || "");
          setInitialEmail(refreshedSessionData.user.email || "");
          setInitialAbsenceNumber(refreshedSessionData.user.user_metadata.absence_number?.toString() || "");
          setInitialClassName(refreshedSessionData.user.user_metadata.class_name || "");
          setInitialAvatarUrl(refreshedSessionData.user.user_metadata.avatar_url || null);
        }
      } else {
        const { data: directUserData, error: directUserError } = await supabase.auth.getUser();
        if (directUserData.user) {
          setUser(directUserData.user);
        } else {
          console.error("EditProfile: Failed to get user directly after session refresh issue:", directUserError?.message);
        }
      }

      Alert.alert("Sukses", "Profil berhasil diperbarui.");
      router.replace("/Dashboard");
    } catch (error: any) {
      console.error("General error in handleSave profile:", error.message, error);
      Alert.alert("Error", `Gagal menyimpan profil: ${error.message || "Terjadi kesalahan tidak diketahui."}`);
    } finally {
      setLoading(false);
    }
  };

  // Fallback for avatar if URL is invalid or null
  const displayAvatar = avatarUrl || initialAvatarUrl;

  useEffect(() => {
    if (fetchProfileError && user) {
      console.warn(
        "Couldn't connect to profiles table. Table might not exist yet.",
      );
    }
  }, [fetchProfileError, user]);

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        className={`flex-row items-center p-4 border-b ${isDarkMode ? "border-gray-700 bg-gray-900" : "border-border bg-background"}`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons
            name="arrow-back-outline"
            size={24}
            color={isDarkMode ? "#fff" : "hsl(var(--foreground))"}
          />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-foreground"}`}
        >
          Edit Profil
        </Text>
      </View>

      <ScrollView
        className={`flex-1 ${isDarkMode ? "bg-gray-900" : "bg-background"}`}
        contentContainerStyle={{ padding: 24 }}
      >
        <View
          className={`rounded-xl p-5 shadow-sm mb-4 items-center ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <View className="relative">
            {uploadingAvatar ? (
              <View className={`w-36 h-36 rounded-full items-center justify-center mb-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                <ActivityIndicator
                  size="large"
                  color={isDarkMode ? "#fff" : "#000"}
                />
              </View>
            ) : (
              <View className="mb-4">
                {displayAvatar ? (
                  <Image
                    source={{ uri: displayAvatar }}
                    className="w-36 h-36 rounded-full"
                  />
                ) : (
                  <View className={`w-36 h-36 rounded-full items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
                    <Ionicons name="person-circle-outline" size={80} color={isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                  </View>
                )}
                <TouchableOpacity
                  className="absolute bottom-0 right-0 bg-primary rounded-full p-3"
                  onPress={pickImage}
                >
                  <Ionicons
                    name="camera"
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
            Ketuk ikon kamera untuk mengubah foto profil
          </Text>
        </View>

        <View
          className={`rounded-xl p-5 shadow-sm mb-4 ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <View className="mb-4">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              Nama
            </Text>
            <Input
              placeholder="Nama lengkap"
              value={name}
              onChangeText={setName}
              className={
                isDarkMode ? "border-gray-600 bg-gray-700 text-white " : ""
              }
            />
          </View>
          <View className="mb-4">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              Email
            </Text>
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              className={
                isDarkMode ? "border-gray-600 bg-gray-700 text-white " : ""
              }
            />
          </View>
          <View className="mb-4">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              No. Absen
            </Text>
            <Input
              placeholder="Nomor Absen"
              value={absenceNumber}
              onChangeText={setAbsenceNumber}
              keyboardType="numeric"
              className={
                isDarkMode ? "border-gray-600 bg-gray-700 text-white " : ""
              }
            />
          </View>
          <View className="mb-6">
            <Text
              className={`mb-2 ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}
            >
              Kelas
            </Text>
            <Input
              placeholder="Kelas"
              value={className}
              onChangeText={setClassName}
              className={
                isDarkMode ? "border-gray-600 bg-gray-700 text-white " : ""
              }
            />
          </View>
        </View>

        <View
          className={`rounded-xl p-5 shadow-sm ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <Button
            variant="default"
            size="lg"
            disabled={loading}
            onPress={handleSave}
            className={`mb-4 w-full ${isDarkMode ? "bg-white" : "bg-black"}`}
          >
            {loading ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator
                  size="small"
                  color={isDarkMode ? "#000" : "#fff"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  className={
                    isDarkMode
                      ? "text-black font-medium"
                      : "text-white font-medium"
                  }
                >
                  Sedang menyimpan...
                </Text>
              </View>
            ) : (
              <Text
                className={
                  isDarkMode
                    ? "text-black font-medium"
                    : "text-white font-medium"
                }
              >
                Simpan
              </Text>
            )}
          </Button>
          <Button
            size="default"
            onPress={() => router.back()}
            disabled={loading}
            className="w-full rounded-lg py-3 bg-red-600"
          >
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text className="text-white">Batal</Text>
            </View>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
