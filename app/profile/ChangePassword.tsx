import { useRouter, Stack } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Key } from "~/lib/icons/Key";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";

export default function ChangePassword() {
  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAllPasswords, setShowAllPasswords] = useState(false);

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

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Error", "Semua kolom harus diisi");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Konfirmasi password tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password baru minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      // Re-authenticate user
      const session = await supabase.auth.getSession();
      const email = session.data.session?.user.email;
      if (!email) throw new Error("Session tidak valid");
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (loginError) {
        Alert.alert("Error", "Password lama salah");
        setLoading(false);
        return;
      }
      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        Alert.alert("Error", error.message);
        setLoading(false);
        return;
      }
      Alert.alert("Sukses", "Password berhasil diubah", [
        { text: "OK", onPress: () => router.back() },
      ]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      Alert.alert("Error", "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      {/* Custom Header */}
      <View
        className={`flex-row items-center px-6 py-4 border-b ${
          isDarkColorScheme
            ? "border-gray-700 bg-gray-900"
            : "border-border bg-background"
        }`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <ChevronLeft
            size={24}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
        </TouchableOpacity>
        <Text
          className={`text-lg font-bold ${
            isDarkColorScheme ? "text-white" : "text-foreground"
          }`}
        >
          Ubah Password
        </Text>
      </View>
      <View className="flex-1">
        <ScrollView
          className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Main Card */}
          <View
            className={`rounded-xl p-6 shadow-sm ${
              isDarkColorScheme ? "bg-gray-800" : "bg-card"
            }`}
          >
            {/* Header Icon */}
            <View className="items-center mb-8">
              <View
                className={`w-20 h-20 rounded-full ${
                  isDarkColorScheme ? "bg-gray-700" : "bg-accent"
                } justify-center items-center mb-4`}
              >
                <Key
                  size={36}
                  color={isDarkColorScheme ? "#ffffff" : "#000000"}
                />
              </View>
              <Text
                className={`text-xl font-bold text-center ${
                  isDarkColorScheme ? "text-white" : "text-card-foreground"
                }`}
              >
                Keamanan Akun
              </Text>
              <Text
                className={`text-sm text-center mt-2 px-4 leading-5 ${
                  isDarkColorScheme ? "text-gray-400" : "text-muted-foreground"
                }`}
              >
                Pastikan password baru Anda aman dan mudah diingat
              </Text>
            </View>
            {/* Form Fields */}
            <View className="space-y-5">
              {/* Current Password */}
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-white" : "text-card-foreground"
                  }`}
                >
                  Password Lama
                </Text>
                <View
                  className={`flex-row items-center border rounded-xl px-4 py-4 ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-border bg-background"
                  }`}
                >
                  <TextInput
                    className={`flex-1 text-base ${
                      isDarkColorScheme
                        ? "text-white placeholder:text-gray-400"
                        : "text-foreground placeholder:text-muted-foreground"
                    }`}
                    placeholder="Masukkan password lama"
                    placeholderTextColor={
                      isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                    }
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="ml-3 p-1"
                  >
                    {showAllPasswords ? (
                      <EyeOff
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    ) : (
                      <Eye
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              {/* New Password */}
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-white" : "text-card-foreground"
                  }`}
                >
                  Password Baru
                </Text>
                <View
                  className={`flex-row items-center border rounded-xl px-4 py-4 ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-border bg-background"
                  }`}
                >
                  <TextInput
                    className={`flex-1 text-base ${
                      isDarkColorScheme
                        ? "text-white placeholder:text-gray-400"
                        : "text-foreground placeholder:text-muted-foreground"
                    }`}
                    placeholder="Masukkan password baru"
                    placeholderTextColor={
                      isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                    }
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="ml-3 p-1"
                  >
                    {showAllPasswords ? (
                      <EyeOff
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    ) : (
                      <Eye
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    )}
                  </TouchableOpacity>
                </View>
                <Text
                  className={`text-xs mt-2 ${
                    isDarkColorScheme
                      ? "text-gray-400"
                      : "text-muted-foreground"
                  }`}
                >
                  Minimal 6 karakter
                </Text>
              </View>
              {/* Confirm Password */}
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDarkColorScheme ? "text-white" : "text-card-foreground"
                  }`}
                >
                  Konfirmasi Password Baru
                </Text>
                <View
                  className={`flex-row items-center border rounded-xl px-4 py-4 ${
                    isDarkColorScheme
                      ? "border-gray-600 bg-gray-700"
                      : "border-border bg-background"
                  }`}
                >
                  <TextInput
                    className={`flex-1 text-base ${
                      isDarkColorScheme
                        ? "text-white placeholder:text-gray-400"
                        : "text-foreground placeholder:text-muted-foreground"
                    }`}
                    placeholder="Ulangi password baru"
                    placeholderTextColor={
                      isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                    }
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="ml-3 p-1"
                  >
                    {showAllPasswords ? (
                      <EyeOff
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    ) : (
                      <Eye
                        size={20}
                        color={isDarkColorScheme ? "#ffffff" : "#000000"}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {/* Action Buttons */}
            <View className="mt-8">
              <Button
                variant="default"
                size="lg"
                disabled={loading}
                onPress={handleChangePassword}
                className={`mb-4 w-full ${isDarkColorScheme ? "bg-white" : "bg-black"}`}
              >
                {loading ? (
                  <View className="flex-row items-center justify-center">
                    <ActivityIndicator
                      size="small"
                      color={isDarkColorScheme ? "#000" : "#fff"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      className={
                        isDarkColorScheme
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
                      isDarkColorScheme
                        ? "text-black font-medium"
                        : "text-white font-medium"
                    }
                  >
                    Simpan Password
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
          </View>
          {/* Footer */}
          <View className="mt-8">
            <View className="items-center">
              <Text
                className={`text-sm ${
                  isDarkColorScheme ? "text-gray-500" : "text-gray-400"
                }`}
              >
                © 2025 Skanida Apps
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
