// app/register.tsx
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
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "~/utils/supabase";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Eye, EyeOff, UserCheck } from "lucide-react-native";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  // User will verify email before login, do not set user here
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

  const handleRegister = async () => {
    setNameError(false);
    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    let hasValidationError = false;
    if (!name) {
      setNameError(true);
      hasValidationError = true;
    }
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
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        console.error("Supabase signup error:", error.message);
        // Tampilkan pesan khusus jika email tidak valid
        const alertMessage = error.message
          .toLowerCase()
          .includes("invalid email")
          ? "Email tidak valid"
          : error.message;
        Alert.alert("Registrasi Gagal", alertMessage, [{ text: "OK" }]);
        return;
      }

      if (data?.user) {
        Alert.alert(
          "Registrasi Berhasil",
          "Silahkan verifikasi email Anda sebelum masuk.",
          [{ text: "OK", onPress: () => router.replace("/auth/AuthSelector") }],
          { cancelable: false },
        );
      }
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView className={`flex-1 bg-background`}>
      <Stack.Screen name="auth/Register" options={{ headerShown: false }} />

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
            <View className="items-center mb-10">
              <View
                className={`w-28 h-28 rounded-full shadow-lg mb-6 items-center justify-center bg-card dark:bg-gray-800`}
              >
                <Icon as={UserCheck} className="size-10 text-foreground" />
              </View>

              <Text
                variant="h1"
                className={`text-3xl font-bold text-center mb-3 text-foreground`}
              >
                Buat Akun Baru
              </Text>

              <Text
                className={`text-center text-base leading-relaxed max-w-sm text-foreground`}
              >
                Bergabunglah dengan Skanida untuk memulai perjalanan Anda
              </Text>
            </View>
            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View
                className={`rounded-2xl p-8 shadow-xl bg-card dark:bg-gray-800`}
              >
                {/* Name Field */}
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium text-foreground`}>
                    Nama Lengkap
                  </Text>
                  <Input
                    placeholder="Masukkan nama lengkap Anda"
                    autoCapitalize="words"
                    value={name}
                    onChangeText={(text) => {
                      setName(text);
                      if (nameError) setNameError(false);
                    }}
                    className="dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:placeholder:text-gray-300"
                  />
                </View>
                {/* Email Field */}
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium text-foreground`}>
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
                <View className="mb-6">
                  <Text className={`mb-3 text-sm font-medium text-foreground`}>
                    Password
                  </Text>
                  <View className="relative">
                    <Input
                      placeholder="Masukkan password"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (passwordError) setPasswordError(false);
                        if (confirmPasswordError && text === confirmPassword) {
                          setConfirmPasswordError(false);
                        }
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
                {/* Confirm Password Field */}
                <View className="mb-8">
                  <Text className={`mb-3 text-sm font-medium text-foreground`}>
                    Konfirmasi Password
                  </Text>
                  <View className="relative">
                    <Input
                      placeholder="Masukkan kembali"
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        if (confirmPasswordError)
                          setConfirmPasswordError(false);
                        if (passwordError && text === password) {
                          setPasswordError(false);
                        }
                      }}
                      className="dark:bg-gray-700 dark:text-white dark:border-gray-600"
                    />
                    <TouchableOpacity
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <Icon as={EyeOff} className="size-5 text-foreground" />
                      ) : (
                        <Icon as={Eye} className="size-5 text-foreground" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Register Button */}
                <Button
                  variant="default"
                  size="lg"
                  className={`w-full h-16 rounded-xl shadow-lg`}
                  onPress={handleRegister}
                  disabled={loading}
                >
                  <Text
                    variant="h3"
                    className={`font-semibold text-lg text-primary-foreground`}
                  >
                    {loading ? "Sedang mendaftar..." : "Daftar"}
                  </Text>
                </Button>
              </View>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text className={`text-base text-foreground`}>
                  Sudah memiliki akun?
                </Text>
                <TouchableOpacity onPress={() => router.push("/auth/Login")}>
                  <Text className={`font-semibold text-base text-primary ml-1`}>
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
