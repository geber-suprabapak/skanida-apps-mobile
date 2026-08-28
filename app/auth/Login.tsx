import { Stack, useRouter } from "expo-router";
import { useState, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";
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
import {
  logoutLogtoSession,
  exchangeLogtoCode,
  getLogtoRedirectUri,
} from "~/utils/logto";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Key } from "lucide-react-native";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const redirectUri = makeRedirectUri({ native: getLogtoRedirectUri() });
  const discovery = {
    authorizationEndpoint: `${process.env.EXPO_PUBLIC_LOGTO_ENDPOINT}/oidc/auth`,
    tokenEndpoint: `${process.env.EXPO_PUBLIC_LOGTO_ENDPOINT}/oidc/token`,
  };
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_LOGTO_APP_ID ?? "skanida-mobile",
      redirectUri,
      scopes: [
        "openid",
        "profile",
        "email",
        "roles",
        "offline_access",
        "mobile:access",
      ],
      usePKCE: true,
      extraParams: email
        ? {
            resource:
              process.env.EXPO_PUBLIC_LOGTO_RESOURCE ??
              "https://api.skanida.sch.id",
            login_hint: email,
          }
        : {
            resource:
              process.env.EXPO_PUBLIC_LOGTO_RESOURCE ??
              "https://api.skanida.sch.id",
          },
    },
    discovery,
  );

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

  useEffect(() => {
    if (!response) return;
    if (response.type === "error") {
      setLoading(false);
      Alert.alert("Login Gagal", "Login identity dibatalkan atau gagal.");
      return;
    }
    if (response.type !== "success") {
      setLoading(false);
      return;
    }
    if (!request?.codeVerifier || !response.params.code) {
      setLoading(false);
      return;
    }
    const code = response.params.code;
    const codeVerifier = request.codeVerifier;

    void (async () => {
      try {
        const user = await exchangeLogtoCode(code, codeVerifier, redirectUri);
        const isStudent = user.roles.some(
          (role) => role === "student" || role === "siswa",
        );
        if (!isStudent) {
          await logoutLogtoSession();
          Alert.alert(
            "Login Gagal",
            "Akun ini tidak memiliki akses. Hubungi administrator.",
          );
          return;
        }
        setUser(user);
        router.replace("/Dashboard");
      } catch (error) {
        if (__DEV__) console.error("[Login] Identity login failed:", error);
        Alert.alert("Login Gagal", "Email/NIS atau password salah.");
      } finally {
        setLoading(false);
      }
    })();
  }, [request, response, redirectUri, router, setUser]);

  const handleLogin = async () => {
    setEmailError(false);
    if (!email.trim()) {
      setEmailError(true);
      return;
    }
    if (!request) {
      Alert.alert("Login Gagal", "Layanan identity belum siap.");
      return;
    }
    setLoading(true);
    await promptAsync();
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
                    NIS atau Email
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
