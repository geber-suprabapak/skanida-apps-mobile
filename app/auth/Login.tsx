import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "~/components/ui/safe-area-view";

import useAuthStore from "~/store/authStore";
import { supabase } from "~/utils/supabase";
import { resolveUserRole } from "~/utils/authUtils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Eye, EyeOff, Key } from "lucide-react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  // Handle hardware back button for Android
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

  const handleLogin = async () => {
    setEmailError(false);
    setPasswordError(false);

    let hasError = false;
    if (!email) {
      setEmailError(true);
      hasError = true;
    }
    if (!password) {
      setPasswordError(true);
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (__DEV__) {
          console.error(
            "[Login] signInWithPassword error:",
            error.message,
            "| code:",
            error.code ?? "n/a",
            "| status:",
            error.status ?? "n/a",
          );
        }
        if (error.message === "Email not confirmed") {
          Alert.alert(
            "Login Gagal",
            "Email belum dikonfirmasi. Silakan periksa email Anda untuk verifikasi.",
          );
        } else {
          Alert.alert(
            "Login Gagal",
            "Email atau password salah. Silakan coba lagi.",
          );
        }
        return;
      }

      if (data?.user) {
        const role = resolveUserRole(
          data.session?.access_token,
          data.user.app_metadata,
        );

        if (role !== "siswa") {
          try {
            await supabase.auth.signOut();
          } catch (signOutErr) {
            if (__DEV__) {
              console.error(
                "[Login] Failed to sign out after role check:",
                signOutErr,
              );
            }
          }
          Alert.alert(
            "Login Gagal",
            "Akun ini tidak memiliki akses. Hubungi administrator.",
          );
          return;
        }

        setUser(data.user);
        router.replace("/Dashboard");
      } else {
        Alert.alert("Login Gagal", "Terjadi kesalahan. Silakan coba lagi.");
      }
    } catch (error) {
      if (__DEV__) {
        console.error("[Login] Unexpected exception during login:", error);
      }
      Alert.alert(
        "Login Gagal",
        "Terjadi kesalahan tak terduga. Silakan coba lagi.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView className={`flex-1 bg-background`}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header with Back Button */}
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`w-12 h-12 rounded-full items-center justify-center shadow-lg bg-card dark:bg-gray-800`}
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
              <View
                className={`w-32 h-32 rounded-full shadow-lg mb-8 items-center justify-center bg-card dark:bg-gray-800`}
              >
                <Icon as={Key} className="size-12 text-foreground" />
              </View>

              <Text
                variant={"h3"}
                className={`text-3xl font-bold text-center mb-3 text-foreground`}
              >
                Selamat Datang Kembali
              </Text>

              <Text
                className={`text-center text-base leading-relaxed max-w-sm text-foreground`}
              >
                Masuk ke akun Anda untuk melanjutkan
              </Text>
            </View>
            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View
                className={`rounded-2xl p-8 shadow-xl bg-card dark:bg-gray-800`}
              >
                {/* Email Field */}
                <View className="mb-6">
                  <Text
                    variant="small"
                    className="mb-3 font-medium text-foreground"
                  >
                    Email
                  </Text>
                  <Input
                    placeholder="Masukkan email Anda"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError(false);
                    }}
                    className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                  />
                </View>
                {/* Password Field */}
                <View className="mb-8">
                  <Text
                    variant="small"
                    className="mb-3 font-medium text-foreground"
                  >
                    Password
                  </Text>
                  <View className="relative">
                    <Input
                      placeholder="Masukkan password Anda"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (passwordError) setPasswordError(false);
                      }}
                      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <Icon as={EyeOff} className="size-5 text-foreground" />
                      ) : (
                        <Icon as={Eye} className="size-5 text-foreground" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Login Button */}
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <Text
                    variant="h3"
                    className={`font-semibold text-lg text-primary-foreground`}
                  >
                    {loading ? "Sedang masuk..." : "Masuk"}
                  </Text>
                </Button>
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text variant="default" className="text-foreground">
                  Belum memiliki akun?
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Activate")}>
                  <Text
                    variant="default"
                    className="font-semibold text-primary ml-1"
                  >
                    Aktivasi sekarang
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Reset Password Link */}
              <View className="flex-row justify-center items-center mt-4">
                <Text variant="default" className="text-foreground">
                  Lupa password?
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/auth/ResetPassword")}
                >
                  <Text
                    variant="default"
                    className="font-semibold text-primary ml-1"
                  >
                    Reset di sini
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
