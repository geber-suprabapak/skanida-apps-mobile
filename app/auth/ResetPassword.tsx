import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
  Alert,
} from "react-native";
import { SafeAreaView } from "~/components/ui/safe-area-view";

import { bffRequest } from "~/utils/bff";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Lock } from "lucide-react-native";

export default function ResetPassword() {
  const [nis, setNis] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  // Handle hardware back button for Android
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [router]);

  const handleResetPassword = async () => {
    setErrorMessage("");
    if (!nis.trim() || !code.trim() || newPassword.length < 8) {
      setErrorMessage("NIS, kode pemulihan, dan password baru wajib diisi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Konfirmasi password tidak cocok.");
      return;
    }

    try {
      setLoading(true);
      await bffRequest("/v1/auth/student/reset-password", {
        method: "POST",
        requireAuth: false,
        body: {
          nis: nis.trim(),
          code: code.trim(),
          new_password: newPassword,
        },
      });
      Alert.alert(
        "Password Diperbarui",
        "Password berhasil diperbarui. Silakan login kembali.",
        [{ text: "OK", onPress: () => router.replace("/auth/Login") }],
      );
    } catch (error) {
      if (__DEV__) console.error("Reset password error:", error);
      setErrorMessage("Kode tidak valid atau sudah kedaluwarsa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header with Back Button */}
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-card dark:bg-gray-800"
        >
          <Icon as={ChevronLeft} className="size-5 text-foreground" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center items-center px-8 py-8">
            {/* Logo and Title Section */}
            <View className="items-center mb-12">
              <View className="w-32 h-32 rounded-full shadow-lg mb-8 items-center justify-center bg-card dark:bg-gray-800">
                <Icon as={Lock} className="size-12 text-foreground" />
              </View>

              <Text
                variant="h3"
                className="text-3xl font-bold text-center mb-3 text-foreground"
              >
                Reset Password
              </Text>

              <Text className="text-center text-base leading-relaxed max-w-sm text-foreground">
                Masukkan NIS, kode pemulihan dari administrator, dan password
                baru.
              </Text>
            </View>

            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View className="rounded-2xl p-8 shadow-xl bg-card dark:bg-gray-800">
                <Text
                  variant="small"
                  className="mb-3 font-medium text-foreground"
                >
                  NIS
                </Text>
                <Input
                  placeholder="Masukkan NIS"
                  keyboardType="number-pad"
                  value={nis}
                  onChangeText={setNis}
                  editable={!loading}
                  className="mb-5 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <Text
                  variant="small"
                  className="mb-3 font-medium text-foreground"
                >
                  Kode pemulihan
                </Text>
                <Input
                  placeholder="Kode dari administrator"
                  value={code}
                  onChangeText={setCode}
                  editable={!loading}
                  className="mb-5 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <Text
                  variant="small"
                  className="mb-3 font-medium text-foreground"
                >
                  Password baru
                </Text>
                <Input
                  placeholder="Minimal 8 karakter"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                  editable={!loading}
                  className="mb-5 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />
                <Text
                  variant="small"
                  className="mb-3 font-medium text-foreground"
                >
                  Konfirmasi password
                </Text>
                <Input
                  placeholder="Ulangi password baru"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                  className="mb-5 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                />

                {/* Error Message */}
                {errorMessage && (
                  <View className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <Text
                      variant="small"
                      className="text-red-600 dark:text-red-400"
                    >
                      {errorMessage}
                    </Text>
                  </View>
                )}

                {/* Submit Button */}
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Text
                    variant="h3"
                    className="font-semibold text-lg text-primary-foreground"
                  >
                    {loading ? "Menyimpan..." : "Ganti Password"}
                  </Text>
                </Button>
              </View>

              {/* Back to Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text variant="default" className="text-foreground">
                  Sudah ingat password?
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text
                    variant="default"
                    className="font-semibold text-primary ml-1"
                  >
                    Kembali ke Login
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
