import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "~/store/authStore";
import { appwriteAuth } from "~/utils/migration/authMigration";
import { account } from "~/utils/appwrite";
import { useColorScheme } from "~/lib/useColorScheme";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";
import { cn } from "~/lib/utils";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";
import { Key } from "~/lib/icons/Key";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const { isDarkColorScheme } = useColorScheme();
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
      const result = await appwriteAuth.signIn(email, password);

      if (!result.success) {
        console.error("Appwrite login error:", result.message); // Keep console log for debugging
        if (
          result.message.includes("Email not confirmed") ||
          result.message.includes("verification")
        ) {
          alert(
            "Email belum dikonfirmasi. Silakan periksa email Anda untuk verifikasi.",
          );
        } else if (result.message.includes("Invalid credentials")) {
          alert("Login gagal. Periksa kembali email dan password Anda.");
        } else {
          alert(`Login gagal: ${result.message}`);
        }
        return;
      }

      // Get user details from Appwrite and set in store
      try {
        const user = await account.get();
        setUser(user);
        router.replace("/Dashboard");
      } catch (userError) {
        console.error("Error getting user details:", userError);
        alert("Login berhasil, tetapi gagal mengambil data pengguna.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Terjadi kesalahan saat login. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen name="auth/Login" options={{ headerShown: false }} />

      {/* Header with Back Button */}
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`w-12 h-12 rounded-full items-center justify-center ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"} shadow-lg`}
        >
          <ChevronLeft
            size={20}
            color={isDarkColorScheme ? "#ffffff" : "#000000"}
          />
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
                className={`w-32 h-32 rounded-full shadow-lg mb-8 ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"} items-center justify-center`}
              >
                <Key
                  size={48}
                  color={isDarkColorScheme ? "#ffffff" : "#374151"}
                />
              </View>

              <H1
                className={`text-3xl font-bold text-center mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
              >
                Selamat Datang Kembali
              </H1>

              <Text
                className={`text-center text-base leading-relaxed max-w-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
              >
                Masuk ke akun Anda untuk melanjutkan
              </Text>
            </View>
            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View
                className={`rounded-2xl p-8 shadow-xl ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/90"}`}
              >
                {/* Email Field */}
                <View className="mb-6">
                  <Text
                    className={`mb-3 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                  >
                    Email
                  </Text>
                  <Input
                    className={cn(
                      "h-16 rounded-xl border-2 px-4 py-4 text-lg",
                      emailError
                        ? "border-red-500"
                        : isDarkColorScheme
                          ? "border-gray-600"
                          : "border-gray-200",
                      isDarkColorScheme
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50",
                      "focus:border-blue-500",
                      "native:text-lg native:leading-[1.2]",
                    )}
                    placeholder="Masukkan email Anda"
                    placeholderTextColor={
                      isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                    }
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError(false);
                    }}
                  />
                </View>
                {/* Password Field */}
                <View className="mb-8">
                  <Text
                    className={`mb-3 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                  >
                    Password
                  </Text>
                  <View className="relative">
                    <Input
                      className={cn(
                        "h-16 rounded-xl border-2 px-4 py-4 pr-16 text-lg",
                        passwordError
                          ? "border-red-500"
                          : isDarkColorScheme
                            ? "border-gray-600"
                            : "border-gray-200",
                        isDarkColorScheme
                          ? "bg-gray-700 text-white"
                          : "bg-gray-50",
                        "focus:border-blue-500",
                        "native:text-lg native:leading-[1.2]",
                      )}
                      placeholder="Masukkan password Anda"
                      placeholderTextColor={
                        isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                      }
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (passwordError) setPasswordError(false);
                      }}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff
                          size={20}
                          color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                        />
                      ) : (
                        <Eye
                          size={20}
                          color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Login Button */}
                <Button
                  variant="default"
                  size="lg"
                  className={`w-full h-16 rounded-xl shadow-lg ${
                    isDarkColorScheme
                      ? "bg-white shadow-gray-900/20"
                      : "bg-gray-900 shadow-gray-900/10"
                  }`}
                  onPress={handleLogin}
                  disabled={loading}
                >
                  <H3
                    className={`font-semibold text-lg ${isDarkColorScheme ? "text-gray-900" : "text-white"}`}
                  >
                    {loading ? "Sedang masuk..." : "Masuk"}
                  </H3>
                </Button>
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text
                  className={`text-base ${isDarkColorScheme ? "text-gray-400" : "text-gray-500"}`}
                >
                  Belum memiliki akun?
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Register")}>
                  <Text
                    className={`font-semibold text-base ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    Daftar sekarang
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
