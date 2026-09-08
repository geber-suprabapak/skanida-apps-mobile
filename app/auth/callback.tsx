import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { Stack, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "~/components/ui/safe-area-view";
import { Text } from "~/components/ui/text";
import { getLogtoUser } from "~/utils/logto";
import useAuthStore from "~/store/authStore";

const SkanidaLogo = require("../../assets/skanidatransparan.png");

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    // Safety fallback: if Login.tsx did not replace route within 3 seconds,
    // verify if a session was established or redirect to AuthSelector.
    const timer = setTimeout(async () => {
      try {
        const user = await getLogtoUser();
        if (user) {
          setUser(user);
          // SAFETY: `/home` is supplied by the new `(tabs)/home.tsx` route; Expo's
          // generated typed-route cache is refreshed by Metro after file changes.
          router.replace("/home" as Href);
        } else {
          router.replace("/auth/AuthSelector");
        }
      } catch {
        router.replace("/auth/AuthSelector");
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, setUser]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center px-8">
        <View className="items-center mb-8">
          <View className="w-28 h-28 rounded-full border border-border shadow-lg mb-6 items-center justify-center bg-card">
            <Image
              source={SkanidaLogo}
              style={{ width: 96, height: 96 }}
              className="w-24 h-24"
              contentFit="contain"
              cachePolicy="memory-disk"
              accessibilityLabel="Logo SMKN 2 Magelang"
            />
          </View>
          <Text
            variant="h3"
            className="text-2xl font-bold text-center mb-2 text-foreground"
          >
            Menyelesaikan Login
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            Memverifikasi akun dan menyiapkan sesi Anda...
          </Text>
        </View>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    </SafeAreaView>
  );
}
