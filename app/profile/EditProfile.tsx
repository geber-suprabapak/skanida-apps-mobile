import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";
import useThemeStore from "~/store/themeStore";
import { supabase } from "~/utils/supabase";

export default function EditProfile() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const router = useRouter();

  const [name, setName] = useState(user?.user_metadata?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [absenceNumber, setAbsenceNumber] = useState(user?.user_metadata?.absence_number || "");
  const [className, setClassName] = useState(user?.user_metadata?.class_name || "");
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [fetchProfileError, setFetchProfileError] = useState(false);

  useEffect(() => {
    // Fetch profile data from user_profiles table when component mounts
    const fetchProfileData = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
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
          setAbsenceNumber(data.absence_number || user?.user_metadata?.absence_number || "");
          setClassName(data.class_name || user?.user_metadata?.class_name || "");
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setFetchProfileError(true);
      }
    };
    
    fetchProfileData();
  }, [user]);

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
        email: email,
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
          class_name: className
        },
        options: {
          data: {
            display_name: name,
          }
        }
      });

      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }

      // Update user_profiles table with all fields including email
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: name,
          email: email, // Make sure to update email in the profile table too
          absence_number: absenceNumber,
          class_name: className
        }, { onConflict: 'user_id' });

      if (profileError) {
        console.error("Error updating profile table:", profileError);
        Alert.alert(
          "Perhatian", 
          "Profil berhasil diperbarui, tetapi ada masalah menyimpan data profil. Beberapa informasi mungkin tidak tersimpan dengan benar.",
          [{ text: "OK" }]
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
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
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
      console.warn("Couldn't connect to profiles table. Table might not exist yet.");
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
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
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
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
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
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
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
                isDarkMode
                  ? "border-gray-600 bg-gray-700 text-white placeholder:text-gray-400"
                  : ""
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
