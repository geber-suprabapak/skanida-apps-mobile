import { useRouter, Stack } from "expo-router";
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

import { Button } from "~/components/ui/button";
import { Icon } from "~/components/ui/icon";
import { Lock, ChevronLeft, Eye, EyeOff } from "lucide-react-native";
import { Text } from "~/components/ui/text";
import { supabase } from "~/utils/supabase";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

export default function ChangePassword() {
  const router = useRouter();
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
    <SafeAreaView className={`flex-1`}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <View
        className={`flex-row items-center p-4 border-b border-gray-200 bg-white`}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Icon as={ChevronLeft} className="size-6 text-black" />
        </TouchableOpacity>

        <Text className={`text-lg font-bold flex-1 text-gray-900`}>
          Ubah Password
        </Text>
      </View>

      <ScrollView
        className={`flex-1`}
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Security Info Section */}
        <View className="px-6 pt-6 pb-4">
          <Card className={`p-6 bg-white border-gray-200`}>
            <View className="items-center">
              <View
                className={`w-16 h-16 rounded-full bg-blue-500 justify-center items-center mb-4`}
                style={{
                  shadowColor: "#3B82F6",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Icon as={Lock} className="size-6 text-white" />
              </View>

              <Text
                className={`text-xl font-bold text-center mb-2 text-gray-900`}
              >
                Keamanan Akun
              </Text>

              <Text className={`text-sm text-center leading-5 text-gray-600`}>
                Pastikan password baru Anda aman dan mudah diingat. Gunakan
                kombinasi huruf, angka, dan simbol.
              </Text>
            </View>
          </Card>
        </View>

        {/* Password Form Section */}
        <View className="px-6 mb-6">
          <Card className={`p-6 bg-white border-gray-200`}>
            <Text className={`text-lg font-semibold mb-6 text-gray-900`}>
              Ubah Password
            </Text>

            <View className="space-y-5">
              {/* Current Password */}
              <View>
                <Text className={`text-sm font-medium mb-2 text-gray-700`}>
                  Password Saat Ini
                </Text>
                <View className="relative">
                  <Input
                    placeholder="Masukkan password lama"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                    className={`pr-12 border-gray-300 bg-white placeholder:text-gray-500`}
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="absolute right-3 top-0 bottom-0 justify-center items-center w-10"
                  >
                    {showAllPasswords ? (
                      <Icon as={EyeOff} className="size-5 text-gray-500" />
                    ) : (
                      <Icon as={Eye} className="size-5 text-gray-500" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View>
                <Text className={`text-sm font-medium mb-2 text-gray-700`}>
                  Password Baru
                </Text>
                <View className="relative">
                  <Input
                    placeholder="Masukkan password baru"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                    className={`pr-12 border-gray-300 bg-white placeholder:text-gray-500`}
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="absolute right-3 top-0 bottom-0 justify-center items-center w-10"
                  >
                    {showAllPasswords ? (
                      <Icon as={EyeOff} className="size-5 text-gray-500" />
                    ) : (
                      <Icon as={Eye} className="size-5 text-gray-500" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text className={`text-xs mt-2 text-gray-600`}>
                  Minimal 6 karakter untuk keamanan yang lebih baik
                </Text>
              </View>

              {/* Confirm Password */}
              <View>
                <Text className={`text-sm font-medium mb-2 text-gray-700`}>
                  Konfirmasi Password Baru
                </Text>
                <View className="relative">
                  <Input
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showAllPasswords}
                    autoCapitalize="none"
                    className={`pr-12 border-gray-300 bg-white placeholder:text-gray-500`}
                  />
                  <TouchableOpacity
                    onPress={() => setShowAllPasswords(!showAllPasswords)}
                    className="absolute right-3 top-0 bottom-0 justify-center items-center w-10"
                  >
                    {showAllPasswords ? (
                      <Icon as={EyeOff} className="size-5 text-gray-500" />
                    ) : (
                      <Icon as={Eye} className="size-5 text-gray-500" />
                    )}
                  </TouchableOpacity>
                </View>
                {confirmPassword && newPassword !== confirmPassword && (
                  <Text className="text-xs mt-2 text-red-500">
                    Password tidak cocok
                  </Text>
                )}
              </View>
            </View>
          </Card>
        </View>

        {/* Action Buttons Section */}
        <View className="px-6">
          <Card className={`p-6 bg-white border-gray-200`}>
            <Button
              variant="default"
              size="lg"
              disabled={loading}
              onPress={handleChangePassword}
              className="mb-3 w-full bg-blue-500 hover:bg-blue-600"
              style={{
                shadowColor: "#3B82F6",
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
                <Text className="text-white font-medium">Simpan Password</Text>
              )}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onPress={() => router.back()}
              disabled={loading}
              className={`w-full border-gray-300 bg-transparent`}
            >
              <Text className="text-gray-700 font-medium">Batal</Text>
            </Button>
          </Card>
        </View>

        {/* Footer */}
        <View className="px-6 pt-6">
          <View className="items-center">
            <Text className={`text-xs text-gray-400`}>
              © 2025 Skanida Apps - Keamanan adalah prioritas kami
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
