import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { useRouter, Stack } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

  useEffect(() => {
    // Fetch profile data from user_profiles table when component mounts
    const fetchProfileData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error.message);
          setFetchProfileError(true);
          return;
        }

        if (data) {
          setProfileData(data);
          // If we have data from profiles, use it to initialize state
          setName(data.full_name || user?.user_metadata?.name || "");
          setAbsenceNumber(
            data.absence_number || user?.user_metadata?.absence_number || "",
          );
          setClassName(
            data.class_name || user?.user_metadata?.class_name || "",
          );
          
          // Set avatar URL from profile data
          if (data.avatar_url) {
            setAvatarUrl(data.avatar_url);
          }
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setFetchProfileError(true);
      }
    };

    fetchProfileData();
  }, [user]);

  // Function to pick an image from the gallery
  const pickImage = async () => {
    try {
      // Request permission to access media library
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'We need permission to access your photos');
        return;
      }
      
      // Launch the image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Upload the avatar to Supabase Storage
        await uploadAvatar(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };
  
  // Function to upload avatar to Supabase storage
  const uploadAvatar = async (uri: string) => {
    if (!user) return;
    
    setUploadingAvatar(true);
    
    try {
      // Fetch the image data
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Generate a unique file name for the avatar
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;
      
      // Upload to the 'avatars' bucket
      const { data: storageData, error: storageError } = await supabase
        .storage
        .from('avatars')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
          upsert: true
        });
      
      if (storageError) {
        throw new Error(storageError.message);
      }
      
      // Get the public URL of the uploaded avatar
      const { data: urlData } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      const newAvatarUrl = urlData?.publicUrl;
      
      if (!newAvatarUrl) {
        throw new Error('Failed to get avatar URL');
      }
      
      // Update the state with the new avatar URL
      setAvatarUrl(newAvatarUrl);
      
      Alert.alert('Success', 'Avatar updated successfully. Click Save to update your profile.');
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert('Error', 'Failed to upload avatar');
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
      // Update email di Supabase
      const { error: emailError } = await supabase.auth.updateUser({
        email,
      });

      if (emailError) {
        Alert.alert("Error", emailError.message);
        setLoading(false);
        return;
      }

      // Update user metadata in Auth
      const { error } = await supabase.auth.updateUser({
        data: {
          name,
          full_name: name,
          absence_number: absenceNumber,
          class_name: className,
          display_name: name,
          avatar_url: avatarUrl, // Add avatar URL to user metadata
        },
      });

      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }

      // Update user_profiles table with all fields including email
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: name,
            email, // Make sure to update email in the profile table too
            absence_number: absenceNumber,
            class_name: className,
            avatar_url: avatarUrl, // Add avatar URL to profile table
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
        // We'll continue but alert the user about the partial success
      }

      // Ambil ulang user terbaru dari Supabase
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData?.user) {
        Alert.alert("Error", "Gagal mengambil data user terbaru");
        setLoading(false);
        return;
      }

      // Refresh profile data after successful update
      const { data: refreshedProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (refreshedProfile) {
        setProfileData(refreshedProfile);
      }

      setUser(userData.user);
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

  // Show message if table doesn't exist yet
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
          headerShown: false, // Hide the default header
        }}
      />

      {/* Custom Header */}
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
        {/* Avatar Section */}
        <View
          className={`rounded-xl p-5 shadow-sm mb-4 items-center ${isDarkMode ? "bg-gray-800" : "bg-card"}`}
        >
          <View className="relative">
            {uploadingAvatar ? (
              <View className="w-24 h-24 rounded-full bg-gray-300 items-center justify-center mb-4">
                <ActivityIndicator 
                  size="small" 
                  color={isDarkMode ? "#fff" : "#000"} 
                />
              </View>
            ) : (
              <View className="mb-4">
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    className="w-24 h-24 rounded-full"
                  />
                ) : (
                  <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
                    <Text className="text-2xl font-bold text-primary-foreground">
                      {name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  className="absolute bottom-0 right-0 bg-primary rounded-full p-2"
                  onPress={pickImage}
                >
                  <Ionicons
                    name="camera"
                    size={18}
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
