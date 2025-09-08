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
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "~/utils/supabase";
import { useColorScheme } from "~/lib/useColorScheme";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { H1, H3 } from "~/components/ui/typography";
import { cn } from "~/lib/utils";
import { ChevronLeft } from "~/lib/icons/ChevronLeft";
import { UserCheck } from "~/lib/icons/UserCheck";
import { Eye } from "~/lib/icons/Eye";
import { EyeOff } from "~/lib/icons/EyeOff";

export default function Activate() {
  const [nis, setNis] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingNis, setCheckingNis] = useState(false);
  const [nisExists, setNisExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    id: string;
    full_name: string;
    nis: string;
    absence_number: string;
    email: string;
    class_name?: string;
  } | null>(null);

  // Error states
  const [nisError, setNisError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const router = useRouter();
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

  const checkNisExists = async () => {
    if (!nis.trim()) {
      setNisError(true);
      return;
    }

    try {
      setCheckingNis(true);
      setNisError(false);

      // Check if NIS exists in user_profiles table
      // Use anonymous access for checking NIS existence
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, nis, absence_number, email, class_name")
        .eq("nis", nis)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error checking NIS:", error);
        console.error("Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        Alert.alert(
          "Error",
          `Terjadi kesalahan saat memeriksa NIS: ${error.message}`,
        );
        return;
      }

      if (data) {
        // Check if this profile already has an email (already activated)
        if (data.email && data.email.trim() !== "") {
          Alert.alert("Error", "NIS ini sudah diaktivasi. Silakan login.");
          return;
        }

        setUserProfile(data);
        setNisExists(true);
      } else {
        // If not found in nis column, try absence_number column
        const { data: dataByAbsence, error: errorByAbsence } = await supabase
          .from("user_profiles")
          .select("id, full_name, nis, absence_number, email, class_name")
          .eq("absence_number", nis)
          .limit(1)
          .maybeSingle();

        if (errorByAbsence) {
          console.error("Error checking absence_number:", errorByAbsence);
          Alert.alert(
            "Error",
            `Terjadi kesalahan saat memeriksa NIS: ${errorByAbsence.message}`,
          );
          return;
        }

        if (dataByAbsence) {
          // Check if this profile already has an email (already activated)
          if (dataByAbsence.email && dataByAbsence.email.trim() !== "") {
            Alert.alert("Error", "NIS ini sudah diaktivasi. Silakan login.");
            return;
          }

          setUserProfile(dataByAbsence);
          setNisExists(true);
        } else {
          Alert.alert(
            "Error",
            "NIS tidak ditemukan dalam sistem. Hubungi administrator.",
          );
          setNisExists(false);
        }
      }
    } catch (error) {
      console.error("NIS check error:", error);
      Alert.alert("Error", "Terjadi kesalahan tak terduga");
    } finally {
      setCheckingNis(false);
    }
  };

  const validateForm = () => {
    let hasError = false;

    // Reset all errors
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    if (!email.trim()) {
      setEmailError(true);
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      hasError = true;
    }

    if (!password) {
      setPasswordError(true);
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError(true);
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError(true);
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError(true);
      hasError = true;
    }

    return !hasError;
  };

  const handleActivate = async () => {
    if (!nisExists || !userProfile) {
      Alert.alert("Error", "Silakan periksa NIS terlebih dahulu");
      return;
    }

    if (!validateForm()) {
      Alert.alert("Error", "Mohon lengkapi semua field dengan benar");
      return;
    }

    try {
      setLoading(true);

      // Sign up user with the existing profile data
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userProfile.full_name,
            nis: userProfile.nis || userProfile.absence_number,
          },
        },
      });

      if (error) {
        console.error("Supabase signup error:", error.message);

        if (error.message.includes("already registered")) {
          Alert.alert("Error", "Email sudah terdaftar");
        } else {
          Alert.alert("Error", "Gagal membuat akun. Coba lagi nanti.");
        }
        return;
      }

      if (data?.user) {
        // Update the existing user profile with email
        const { error: profileError } = await supabase
          .from("user_profiles")
          .update({
            email: email,
          })
          .eq("id", userProfile.id);

        if (profileError) {
          console.error("Error updating profile:", profileError.message);
          Alert.alert("Error", "Gagal mengupdate profil pengguna");
          return;
        }

        Alert.alert(
          "Berhasil!",
          "Akun berhasil diaktivasi. Silakan periksa email Anda untuk verifikasi sebelum login.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/auth/Login"),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Activation error:", error);
      Alert.alert("Error", "Terjadi kesalahan tak terduga");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDarkColorScheme ? "bg-gray-900" : "bg-background"}`}
    >
      <Stack.Screen name="auth/Activate" options={{ headerShown: false }} />

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
            <View className="items-center mb-8">
              <View
                className={`w-32 h-32 rounded-full shadow-lg mb-8 ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"} items-center justify-center`}
              >
                <UserCheck
                  size={48}
                  color={isDarkColorScheme ? "#ffffff" : "#374151"}
                />
              </View>

              <H1
                className={`text-3xl font-bold text-center mb-3 ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
              >
                Aktivasi Akun
              </H1>

              <Text
                className={`text-center text-base leading-relaxed max-w-sm ${isDarkColorScheme ? "text-gray-300" : "text-gray-600"}`}
              >
                {!nisExists
                  ? "Masukkan NIS Anda untuk memulai proses aktivasi akun"
                  : "Lengkapi email dan password untuk mengaktifkan akun Anda"}
              </Text>
            </View>

            {/* Form Section */}
            <View className="w-full max-w-sm space-y-4">
              <View
                className={`rounded-2xl p-6 shadow-xl ${isDarkColorScheme ? "bg-gray-800/50" : "bg-white/90"}`}
              >
                {/* NIS Field */}
                <View className="mb-4">
                  <Text
                    className={`mb-2 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                  >
                    NIS
                  </Text>
                  <Input
                    className={cn(
                      "h-14 rounded-xl border-2 px-4 py-3 text-base",
                      nisError
                        ? "border-red-500"
                        : isDarkColorScheme
                          ? "border-gray-600"
                          : "border-gray-200",
                      isDarkColorScheme
                        ? "bg-gray-700 text-white"
                        : "bg-gray-50",
                      "focus:border-blue-500",
                      "native:text-base native:leading-[1.2]",
                    )}
                    placeholder="Masukkan NIS Anda"
                    placeholderTextColor={
                      isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                    }
                    keyboardType="numeric"
                    value={nis}
                    onChangeText={(text) => {
                      setNis(text);
                      if (nisError) setNisError(false);
                      // Reset form when NIS changes
                      if (nisExists) {
                        setNisExists(false);
                        setUserProfile(null);
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                      }
                    }}
                    editable={!nisExists}
                  />

                  {/* Edit NIS Button - only show when NIS is verified */}
                  {nisExists && (
                    <TouchableOpacity
                      className="mt-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-700"
                      onPress={() => {
                        setNisExists(false);
                        setUserProfile(null);
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      <Text className="text-center text-sm text-gray-600 dark:text-gray-400">
                        📝 Ubah NIS
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Check NIS Button */}
                {!nisExists && (
                  <Button
                    variant="outline"
                    size="lg"
                    className={`w-full h-14 rounded-xl mb-4 ${
                      isDarkColorScheme ? "border-gray-600" : "border-gray-300"
                    }`}
                    onPress={checkNisExists}
                    disabled={checkingNis || !nis.trim()}
                  >
                    <H3
                      className={`font-semibold text-base ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                    >
                      {checkingNis ? "Memeriksa NIS..." : "Periksa NIS"}
                    </H3>
                  </Button>
                )}

                {/* Show user info when NIS is found */}
                {nisExists && userProfile && (
                  <View className="mb-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <Text className="text-green-800 dark:text-green-200 font-medium mb-2">
                      ✅ NIS ditemukan!
                    </Text>

                    <View className="space-y-2">
                      <View className="flex-row justify-between">
                        <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
                          Nama:
                        </Text>
                        <Text className="text-green-700 dark:text-green-300 text-sm">
                          {userProfile.full_name}
                        </Text>
                      </View>

                      {userProfile.absence_number && (
                        <View className="flex-row justify-between">
                          <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
                            No. Absen:
                          </Text>
                          <Text className="text-green-700 dark:text-green-300 text-sm">
                            {userProfile.absence_number}
                          </Text>
                        </View>
                      )}

                      {userProfile.class_name && (
                        <View className="flex-row justify-between">
                          <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
                            Kelas:
                          </Text>
                          <Text className="text-green-700 dark:text-green-300 text-sm">
                            {userProfile.class_name}
                          </Text>
                        </View>
                      )}

                      <Text className="text-green-600 dark:text-green-400 text-xs mt-2">
                        Silakan lengkapi email dan password untuk aktivasi
                      </Text>
                    </View>
                  </View>
                )}

                {/* Email and Password fields - only show when NIS exists */}
                {nisExists && (
                  <>
                    {/* Email Field */}
                    <View className="mb-4">
                      <Text
                        className={`mb-2 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                      >
                        Email
                      </Text>
                      <Input
                        className={cn(
                          "h-14 rounded-xl border-2 px-4 py-3 text-base",
                          emailError
                            ? "border-red-500"
                            : isDarkColorScheme
                              ? "border-gray-600"
                              : "border-gray-200",
                          isDarkColorScheme
                            ? "bg-gray-700 text-white"
                            : "bg-gray-50",
                          "focus:border-blue-500",
                          "native:text-base native:leading-[1.2]",
                        )}
                        placeholder="Masukkan email"
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
                    <View className="mb-4">
                      <Text
                        className={`mb-2 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                      >
                        Password
                      </Text>
                      <View className="relative">
                        <Input
                          className={cn(
                            "h-14 rounded-xl border-2 px-4 py-3 pr-14 text-base",
                            passwordError
                              ? "border-red-500"
                              : isDarkColorScheme
                                ? "border-gray-600"
                                : "border-gray-200",
                            isDarkColorScheme
                              ? "bg-gray-700 text-white"
                              : "bg-gray-50",
                            "focus:border-blue-500",
                            "native:text-base native:leading-[1.2]",
                          )}
                          placeholder="Masukkan password (min. 6 karakter)"
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

                    {/* Confirm Password Field */}
                    <View className="mb-6">
                      <Text
                        className={`mb-2 text-sm font-medium ${isDarkColorScheme ? "text-gray-200" : "text-gray-700"}`}
                      >
                        Konfirmasi Password
                      </Text>
                      <View className="relative">
                        <Input
                          className={cn(
                            "h-14 rounded-xl border-2 px-4 py-3 pr-14 text-base",
                            confirmPasswordError
                              ? "border-red-500"
                              : isDarkColorScheme
                                ? "border-gray-600"
                                : "border-gray-200",
                            isDarkColorScheme
                              ? "bg-gray-700 text-white"
                              : "bg-gray-50",
                            "focus:border-blue-500",
                            "native:text-base native:leading-[1.2]",
                          )}
                          placeholder="Konfirmasi password"
                          placeholderTextColor={
                            isDarkColorScheme ? "#9CA3AF" : "#6B7280"
                          }
                          secureTextEntry={!showConfirmPassword}
                          value={confirmPassword}
                          onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (confirmPasswordError)
                              setConfirmPasswordError(false);
                          }}
                        />
                        <TouchableOpacity
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          onPress={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          {showConfirmPassword ? (
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

                    {/* Activate Button */}
                    <Button
                      variant="default"
                      size="lg"
                      className={`w-full h-14 rounded-xl shadow-lg ${
                        isDarkColorScheme
                          ? "bg-white shadow-gray-900/20"
                          : "bg-gray-900 shadow-gray-900/10"
                      }`}
                      onPress={handleActivate}
                      disabled={loading}
                    >
                      <H3
                        className={`font-semibold text-base ${isDarkColorScheme ? "text-gray-900" : "text-white"}`}
                      >
                        {loading ? "Sedang aktivasi..." : "Aktivasi Akun"}
                      </H3>
                    </Button>
                  </>
                )}
              </View>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text
                  className={`text-base ${isDarkColorScheme ? "text-gray-400" : "text-gray-500"}`}
                >
                  Sudah punya akun?{" "}
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text
                    className={`font-semibold text-base ${isDarkColorScheme ? "text-white" : "text-gray-900"}`}
                  >
                    Masuk
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
