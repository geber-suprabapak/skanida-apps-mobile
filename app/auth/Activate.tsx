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

// Tipe data yang BENAR dan sesuai dengan database Anda
type SiswaProfile = {
  nama: string;
  nis: string; // Disimpan sebagai text di DB
  kelas?: string;
  activated: boolean;
};

export default function Activate() {
  const [nis, setNis] = useState(""); // Input dari pengguna (selalu string)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingNis, setCheckingNis] = useState(false);
  const [nisExists, setNisExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Gunakan tipe data SiswaProfile yang sudah didefinisikan
  const [userProfile, setUserProfile] = useState<SiswaProfile | null>(null);

  // Error states
  const [nisError, setNisError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const router = useRouter();
  const { isDarkColorScheme } = useColorScheme();

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

  const checkNisExists = async () => {
    if (!nis.trim()) {
      setNisError(true);
      return;
    }

    // Validate NIS is numeric
    if (!/^\d+$/.test(nis.trim())) {
      Alert.alert("Error", "NIS harus berupa angka.");
      return;
    }

    try {
      setCheckingNis(true);
      setNisError(false);

      const { data, error } = await supabase.rpc("get_biodata_siswa", {
        p_nis: nis.trim(),
      });

      if (error) {
        Alert.alert("Error", `Terjadi kesalahan: ${error.message}`);
        return;
      }

      const profile = Array.isArray(data) ? data[0] : data;

      if (!profile) {
        Alert.alert("Error", "NIS tidak ditemukan. Hubungi administrator.");
        return;
      }

      if (profile.activated) {
        Alert.alert("Error", "NIS sudah diaktivasi. Silakan login.");
        return;
      }

      setNisExists(true);
      setUserProfile(profile);
    } catch {
      Alert.alert("Error", "Terjadi kesalahan tak terduga");
    } finally {
      setCheckingNis(false);
    }
  };

  const validateForm = () => {
    let hasError = false;
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      hasError = true;
    }
    if (!password || password.length < 6) {
      setPasswordError(true);
      hasError = true;
    }
    if (!confirmPassword || password !== confirmPassword) {
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

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: userProfile.nama,
            nis: userProfile.nis,
          },
        },
      });

      if (error) {
        console.error("Supabase signup error:", error.message);
        if (error.message.includes("already registered")) {
          Alert.alert("Error", "Email sudah terdaftar");
        } else {
          Alert.alert("Error", `Gagal membuat akun: ${error.message}`);
        }
        setLoading(false); // Pastikan loading berhenti jika ada error
        return;
      }

      // Jika pendaftaran berhasil, arahkan pengguna untuk verifikasi email.
      // Logika aktivasi profil akan ditangani setelah login pertama.
      Alert.alert(
        "Verifikasi Diperlukan",
        "Akun berhasil dibuat. Silakan verifikasi email Anda, lalu login untuk menyelesaikan aktivasi.",
        [{ text: "OK", onPress: () => router.replace("/auth/Login") }],
      );
    } catch (error) {
      console.error("Activation error:", error);
      Alert.alert("Error", "Terjadi kesalahan tak terduga saat aktivasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${
        isDarkColorScheme ? "bg-gray-900" : "bg-background"
      }`}
    >
      <Stack.Screen name="auth/Activate" options={{ headerShown: false }} />
      <View className="flex-row items-center p-6 pt-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className={`w-12 h-12 rounded-full items-center justify-center ${
            isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"
          } shadow-lg`}
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
            <View className="items-center mb-8">
              <View
                className={`w-32 h-32 rounded-full shadow-lg mb-8 ${
                  isDarkColorScheme ? "bg-gray-800/50" : "bg-white/80"
                } items-center justify-center`}
              >
                <UserCheck
                  size={48}
                  color={isDarkColorScheme ? "#ffffff" : "#374151"}
                />
              </View>
              <H1
                className={`text-3xl font-bold text-center mb-3 ${
                  isDarkColorScheme ? "text-white" : "text-gray-900"
                }`}
              >
                Aktivasi Akun
              </H1>
              <Text
                className={`text-center text-base leading-relaxed max-w-sm ${
                  isDarkColorScheme ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {!nisExists
                  ? "Masukkan NIS Anda untuk memulai proses aktivasi akun"
                  : "Lengkapi email dan password untuk mengaktifkan akun Anda"}
              </Text>
            </View>

            <View className="w-full max-w-sm space-y-4">
              <View
                className={`rounded-2xl p-6 shadow-xl ${
                  isDarkColorScheme ? "bg-gray-800/50" : "bg-white/90"
                }`}
              >
                <View className="mb-4">
                  <Text
                    className={`mb-2 text-sm font-medium ${
                      isDarkColorScheme ? "text-gray-200" : "text-gray-700"
                    }`}
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
                      className={`font-semibold text-base ${
                        isDarkColorScheme ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {checkingNis ? "Memeriksa NIS..." : "Periksa NIS"}
                    </H3>
                  </Button>
                )}

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
                          {userProfile.nama}
                        </Text>
                      </View>

                      {userProfile.kelas && (
                        <View className="flex-row justify-between">
                          <Text className="text-green-700 dark:text-green-300 text-sm font-medium">
                            Kelas:
                          </Text>
                          <Text className="text-green-700 dark:text-green-300 text-sm">
                            {userProfile.kelas}
                          </Text>
                        </View>
                      )}

                      <Text className="text-green-600 dark:text-green-400 text-xs mt-2">
                        Silakan lengkapi email dan password untuk aktivasi
                      </Text>
                    </View>
                  </View>
                )}

                {nisExists && (
                  <>
                    <View className="mb-4">
                      <Text
                        className={`mb-2 text-sm font-medium ${
                          isDarkColorScheme ? "text-gray-200" : "text-gray-700"
                        }`}
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

                    <View className="mb-4">
                      <Text
                        className={`mb-2 text-sm font-medium ${
                          isDarkColorScheme ? "text-gray-200" : "text-gray-700"
                        }`}
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

                    <View className="mb-6">
                      <Text
                        className={`mb-2 text-sm font-medium ${
                          isDarkColorScheme ? "text-gray-200" : "text-gray-700"
                        }`}
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
                        className={`font-semibold text-base ${
                          isDarkColorScheme ? "text-gray-900" : "text-white"
                        }`}
                      >
                        {loading ? "Sedang aktivasi..." : "Aktivasi Akun"}
                      </H3>
                    </Button>
                  </>
                )}
              </View>

              <View className="flex-row justify-center items-center mt-6">
                <Text
                  className={`text-base ${
                    isDarkColorScheme ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Sudah punya akun?{" "}
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text
                    className={`font-semibold text-base ${
                      isDarkColorScheme ? "text-white" : "text-gray-900"
                    }`}
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
