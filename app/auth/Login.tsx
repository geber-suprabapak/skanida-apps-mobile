import { Stack, useRouter, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { useAuthRequest } from "expo-auth-session";
import { View, TouchableOpacity, Alert, BackHandler } from "react-native";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import useAuthStore from "~/store/authStore";
import {
  logoutLogtoSession,
  exchangeLogtoCode,
  getLogtoRedirectUri,
} from "~/utils/logto";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Icon } from "~/components/ui/icon";
import { ChevronLeft, Key } from "lucide-react-native";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const [loading, setLoading] = useState(false);
  const hasStartedAuth = useRef(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const redirectUri = getLogtoRedirectUri();
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
      extraParams: {
        resource:
          process.env.EXPO_PUBLIC_LOGTO_RESOURCE ??
          "https://astrayao.lunaradev.my.id",
      },
    },
    discovery,
  );

  useEffect(() => {
    if (!request || hasStartedAuth.current) return;

    hasStartedAuth.current = true;
    setLoading(true);
    void promptAsync().catch(() => {
      hasStartedAuth.current = false;
      setLoading(false);
      Alert.alert("Login Gagal", "Layanan identity belum siap.");
    });
  }, [promptAsync, request]);

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
        // SAFETY: `/home` is supplied by the new `(tabs)/home.tsx` route; Expo's
        // generated typed-route cache is refreshed by Metro after file changes.
        router.replace("/home" as Href);
      } catch (error) {
        if (__DEV__) console.error("[Login] Identity login failed:", error);
        Alert.alert(
          "Login Gagal",
          "Autentikasi identity gagal. Silakan coba lagi.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [request, response, redirectUri, router, setUser]);

  const retryLogin = async () => {
    if (!request) {
      Alert.alert("Login Gagal", "Layanan identity belum siap.");
      return;
    }
    hasStartedAuth.current = true;
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          accessibilityHint="Ketuk dua kali untuk kembali"
          className="w-12 h-12 rounded-full items-center justify-center shadow-lg bg-card"
        >
          <Icon as={ChevronLeft} className="size-5 text-foreground" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 justify-center items-center px-8 py-8">
        <View className="items-center mb-12">
          <View className="w-32 h-32 rounded-full shadow-lg mb-8 items-center justify-center bg-card">
            <Icon as={Key} className="size-12 text-foreground" />
          </View>

          <Text
            variant={"h3"}
            className={`text-3xl font-bold text-center mb-3 text-foreground`}
          >
            Menghubungkan ke Login
          </Text>

          <Text
            className={`text-center text-base leading-relaxed max-w-sm text-foreground`}
          >
            {loading
              ? "Membuka halaman autentikasi..."
              : "Halaman autentikasi tidak terbuka? Coba lagi."}
          </Text>
        </View>

        {!loading && (
          <Button variant="default" size="lg" onPress={retryLogin}>
            <Text className="font-semibold text-lg text-primary-foreground">
              Coba lagi
            </Text>
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}
