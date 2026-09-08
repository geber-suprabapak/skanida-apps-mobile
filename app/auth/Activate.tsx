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
import {
  ChevronLeft,
  UserCheck,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react-native";
import { Icon } from "~/components/ui/icon";

import { bffRequest } from "~/utils/bff";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";

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

  useEffect(() => {
    const backAction = () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
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
      setNisExists(true);
      setUserProfile({
        nama: "",
        nis: nis.trim(),
        activated: false,
      });
    } finally {
      setCheckingNis(false);
    }
  };

  const validateForm = (): boolean => {
    const validationMessages: string[] = [];
    const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$/;

    setEmailError(false);
    setPasswordError(false);
    setConfirmPasswordError(false);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      validationMessages.push(
        "Email wajib diisi dan harus menggunakan format yang valid.",
      );
    }

    if (!password.trim()) {
      setPasswordError(true);
      validationMessages.push("Password wajib diisi.");
    } else if (!passwordRegex.test(password)) {
      setPasswordError(true);
      validationMessages.push(
        "Password harus minimal 8 karakter dan mengandung huruf besar, huruf kecil, serta angka.",
      );
    }

    if (!confirmPassword.trim()) {
      setConfirmPasswordError(true);
      validationMessages.push("Konfirmasi password wajib diisi.");
    } else if (password !== confirmPassword) {
      setConfirmPasswordError(true);
      validationMessages.push(
        "Konfirmasi password harus sama dengan password.",
      );
    }

    if (validationMessages.length > 0) {
      Alert.alert(
        "Periksa kembali data Anda",
        validationMessages.map((message) => `• ${message}`).join("\n"),
      );
    }

    return validationMessages.length === 0;
  };

  const handleActivate = async () => {
    if (!nisExists || !userProfile) {
      Alert.alert("Error", "Silakan periksa NIS terlebih dahulu");
      return;
    }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await bffRequest("/v1/auth/student/signup", {
        method: "POST",
        requireAuth: false,
        body: {
          nis: userProfile.nis,
          email: email.trim(),
          password,
        },
      });
      Alert.alert(
        "Pendaftaran Dikirim",
        "Pendaftaran berhasil dikirim dan menunggu persetujuan sekolah.",
        [{ text: "OK", onPress: () => router.replace("/auth/Login") }],
      );
    } catch (error) {
      if (__DEV__) console.error("Activation error:", error);
      Alert.alert("Error", "Terjadi kesalahan tak terduga saat aktivasi");
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          accessibilityHint="Ketuk dua kali untuk kembali"
          className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-card"
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
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full items-center px-8 py-8">
            {/* Logo and Title Section */}
            <View className="items-center mb-12">
              <View className="w-32 h-32 rounded-full shadow-lg mb-8 items-center justify-center bg-card">
                <Icon as={UserCheck} className="size-12 text-foreground" />
              </View>
              <Text
                variant="h3"
                className="text-3xl font-bold text-center mb-3 text-foreground"
              >
                Aktivasi Akun
              </Text>
              <Text className="text-center text-base leading-relaxed max-w-sm text-foreground">
                {!nisExists
                  ? "Masukkan NIS Anda untuk memulai proses aktivasi akun"
                  : "Lengkapi email dan password untuk mengaktifkan akun Anda"}
              </Text>
            </View>

            {/* Form Section */}
            <View className="w-full max-w-sm space-y-6">
              <View className="rounded-2xl p-8 shadow-xl bg-card">
                <View className="mb-4">
                  <Text
                    variant="small"
                    className="mb-3 font-medium text-foreground"
                  >
                    NIS
                  </Text>
                  <Input
                    placeholder="Masukkan NIS Anda"
                    placeholderTextColor="#6B7280"
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
                    className={`bg-card ${
                      nisError ? "border-destructive" : ""
                    }`}
                  />

                  {nisExists && (
                    <TouchableOpacity
                      className="mt-2 p-2 rounded-lg bg-muted"
                      onPress={() => {
                        setNisExists(false);
                        setUserProfile(null);
                        setEmail("");
                        setPassword("");
                        setConfirmPassword("");
                      }}
                    >
                      <Text
                        variant="small"
                        className="text-center text-muted-foreground"
                      >
                        📝 Ubah NIS
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!nisExists && (
                  <Button
                    variant="default"
                    size="lg"
                    className="w-full mb-4"
                    onPress={checkNisExists}
                    disabled={checkingNis || !nis.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Periksa NIS"
                    accessibilityState={{
                      disabled: checkingNis || !nis.trim(),
                      busy: checkingNis,
                    }}
                  >
                    <Text className="font-semibold text-primary-foreground">
                      {checkingNis ? "Memeriksa NIS..." : "Periksa NIS"}
                    </Text>
                  </Button>
                )}

                {nisExists && userProfile && (
                  <View className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                    <View className="flex-row items-start">
                      <Icon
                        as={CheckCircle2}
                        className="size-6 text-emerald-600"
                      />
                      <View className="ml-3 flex-1 space-y-1">
                        <Text
                          variant="p"
                          className="font-semibold text-emerald-700"
                        >
                          NIS siap diperiksa
                        </Text>
                        <Text className="text-muted-foreground">
                          Sistem sekolah akan memvalidasi NIS terhadap data siswa
                          saat pendaftaran dikirim.
                        </Text>
                      </View>
                    </View>

                    <View className="mt-4 space-y-3 rounded-xl bg-muted p-4">
                      <View className="space-y-2">
                        <View className="flex-row">
                          <Text className="w-20 font-medium text-muted-foreground">
                            NIS
                          </Text>
                          <Text className="flex-1 text-foreground">
                            {userProfile.nis}
                          </Text>
                        </View>

                        <View className="flex-row">
                          <Text className="w-20 font-medium text-muted-foreground">
                            Nama
                          </Text>
                          <Text className="flex-1 text-foreground">
                            {userProfile.nama || "-"}
                          </Text>
                        </View>
                        {userProfile.kelas ? (
                          <View className="flex-row">
                            <Text className="w-20 font-medium text-muted-foreground">
                              Kelas
                            </Text>
                            <Text className="flex-1 text-foreground">
                              {userProfile.kelas}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}

                {nisExists && (
                  <>
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
                        className={`bg-card ${
                          emailError ? "border-destructive" : ""
                        }`}
                      />
                    </View>

                    {/* Password Field */}
                    <View className="mb-6">
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
                          className={`bg-card ${
                            passwordError ? "border-destructive" : ""
                          }`}
                        />
                        <TouchableOpacity
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showPassword
                              ? "Sembunyikan password"
                              : "Tampilkan password"
                          }
                          accessibilityHint="Ketuk dua kali untuk mengubah visibilitas password"
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          <Icon
                            as={showPassword ? EyeOff : Eye}
                            className="size-5 text-foreground"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Confirm Password Field */}
                    <View className="mb-8">
                      <Text
                        variant="small"
                        className="mb-3 font-medium text-foreground"
                      >
                        Konfirmasi Password
                      </Text>
                      <View className="relative">
                        <Input
                          placeholder="Konfirmasi password Anda"
                          secureTextEntry={!showConfirmPassword}
                          value={confirmPassword}
                          onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (confirmPasswordError)
                              setConfirmPasswordError(false);
                          }}
                          className={`bg-card ${
                            confirmPasswordError ? "border-destructive" : ""
                          }`}
                        />
                        <TouchableOpacity
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          accessibilityRole="button"
                          accessibilityLabel={
                            showConfirmPassword
                              ? "Sembunyikan konfirmasi password"
                              : "Tampilkan konfirmasi password"
                          }
                          accessibilityHint="Ketuk dua kali untuk mengubah visibilitas konfirmasi password"
                          onPress={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        >
                          <Icon
                            as={showConfirmPassword ? EyeOff : Eye}
                            className="size-5 text-foreground"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Activate Button */}
                    <Button
                      variant="default"
                      size="lg"
                      onPress={handleActivate}
                      disabled={loading}
                      accessibilityRole="button"
                      accessibilityLabel="Aktivasi Akun"
                      accessibilityState={{ disabled: loading, busy: loading }}
                    >
                      <Text className="font-semibold text-lg text-primary-foreground">
                        {loading ? "Sedang aktivasi..." : "Aktivasi Akun"}
                      </Text>
                    </Button>
                  </>
                )}
              </View>

              {/* Login Link */}
              <View className="flex-row justify-center items-center mt-6">
                <Text variant="default" className="text-foreground">
                  Sudah punya akun?{" "}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/auth/Login")}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityRole="button"
                  accessibilityLabel="Masuk"
                  className="min-h-[48px] justify-center"
                >
                  <Text
                    variant="default"
                    className="font-semibold text-primary ml-1"
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
