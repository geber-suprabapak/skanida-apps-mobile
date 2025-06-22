// app/register.tsx
import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { View, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import useAuthStore from "~/store/authStore";
import { useColorScheme } from "~/lib/useColorScheme";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";
import { cn } from "~/lib/utils";
import { supabase } from "~/utils/supabase";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";
import { UserCheck } from "~/lib/icons/UserCheck";

export default function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const { isDarkColorScheme } = useColorScheme();
  // Handle hardware back button for Android
  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);

    return () => backHandler.remove();
  }, [router]);

  const handleRegister = async () => {
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    let hasValidationError = false;
    if (!email) {
      setEmailError(true);
      hasValidationError = true;
    }
    if (!password) {
      setPasswordError(true);
      hasValidationError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError(true);
      hasValidationError = true;
    }

    let passwordMismatch = false;
    if (password && confirmPassword && password !== confirmPassword) {
      setPasswordError(true);
      setConfirmPasswordError(true);
      passwordMismatch = true;
    }

    if (hasValidationError || passwordMismatch) {
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error("Supabase signup error:", error.message);
        return;
      }

      if (data?.user) {
        setUser(data.user);
        router.replace("/Dashboard");
      }
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };  return (
    <SafeAreaView className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}>
      <Stack.Screen name="auth/Register" options={{ headerShown: false }} />

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
      >        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 justify-center items-center px-8 py-8">            {/* Logo and Title Section */}
            <View className="items-center mb-10">
              <View className={`w-28 h-28 rounded-full shadow-lg mb-6 ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"} items-center justify-center`}>
                <UserCheck
                  size={40}
                  color={isDarkColorScheme ? "#ffffff" : "#374151"}
                />
              </View>

              <H1 className={`text-3xl font-bold text-center mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}>
                Buat Akun Baru
              </H1>

              <Text className={`text-center text-base leading-relaxed max-w-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}>
                Bergabunglah dengan Skanida untuk memulai perjalanan Anda
              </Text>
            </View>

            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View className={`rounded-2xl p-8 shadow-xl ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/90"}`}>                {/* Email Field */}
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}>
                    Email
                  </Text>
                  <Input
                    className={cn(
                      "h-16 rounded-xl border-2 px-4 py-4 text-lg",
                      emailError ? "border-red-500" : (isDarkColorScheme ? "border-gray-600" : "border-gray-200"),
                      isDarkColorScheme ? "bg-gray-700 text-white" : "bg-gray-50",
                      "focus:border-blue-500",
                      "native:text-lg native:leading-[1.2]"
                    )}
                    placeholder="Masukkan email Anda"
                    placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError(false);
                    }}
                  />
                </View>                {/* Password Field */}
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}>
                    Password
                  </Text>
                  <View className="relative">
                    <Input
                      className={cn(
                        "h-16 rounded-xl border-2 px-4 py-4 pr-16 text-lg",
                        passwordError ? "border-red-500" : (isDarkColorScheme ? "border-gray-600" : "border-gray-200"),
                        isDarkColorScheme ? "bg-gray-700 text-white" : "bg-gray-50",
                        "focus:border-blue-500",
                        "native:text-lg native:leading-[1.2]"
                      )}
                      placeholder="Masukkan password"
                      placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (passwordError) setPasswordError(false);
                        if (confirmPasswordError && text === confirmPassword) {
                          setConfirmPasswordError(false);
                        }
                      }}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"} />
                      ) : (
                        <Eye size={20} color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>                {/* Confirm Password Field */}
                <View className="mb-8">
                  <Text className={`mb-3 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}>
                    Konfirmasi Password
                  </Text>
                  <View className="relative">
                    <Input
                      className={cn(
                        "h-16 rounded-xl border-2 px-4 py-4 pr-16 text-lg",
                        confirmPasswordError ? "border-red-500" : (isDarkColorScheme ? "border-gray-600" : "border-gray-200"),
                        isDarkColorScheme ? "bg-gray-700 text-white" : "bg-gray-50",
                        "focus:border-blue-500",
                        "native:text-lg native:leading-[1.2]"
                      )}
                      placeholder="Masukkan kembali"
                      placeholderTextColor={isDarkColorScheme ? "#9CA3AF" : "#6B7280"}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (confirmPasswordError) setConfirmPasswordError(false);
                        if (passwordError && text === password) {
                          setPasswordError(false);
                        }
                      }}
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"} />
                      ) : (
                        <Eye size={20} color={isDarkColorScheme ? "#9CA3AF" : "#6B7280"} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>                {/* Register Button */}
                <Button
                  variant="default"
                  size="lg"
                  className={`w-full h-16 rounded-xl shadow-lg ${
                    isDarkColorScheme
                      ? "bg-white shadow-gray-900/20"
                      : "bg-gray-900 shadow-gray-900/10"
                  }`}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  <H3 className={`font-semibold text-lg ${isDarkColorScheme ? "text-gray-900" : "text-white"}`}>
                    {loading ? "Sedang mendaftar..." : "Daftar"}
                  </H3>
                </Button>
              </View>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text className={`text-base ${isDarkColorScheme ? "text-gray-400" : "text-gray-500"}`}>
                  Sudah memiliki akun?{" "}
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text className={`font-semibold text-base ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}>
                    Masuk sekarang
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
