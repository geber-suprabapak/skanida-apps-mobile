// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";
import { SafeLoadingScreen } from "~/components/SafeLoadingScreen";
import { requiresSafeNativeWindInit } from "~/lib/deviceUtils";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  const requiresSafeInit = requiresSafeNativeWindInit();

  console.log("[Index] Index component initialized");
  console.log("[Index] Safe initialization required:", requiresSafeInit);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("[Index] Starting authentication check");
        console.log("[Index] Requires safe initialization:", requiresSafeInit);
        
        // Add delay for Transsion devices to ensure UI is stable
        if (requiresSafeInit) {
          console.log("[Index] 🔄 Applying 1s stabilization delay for Transsion device");
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("[Index] ✅ Stabilization delay completed");
        }

        console.log("[Index] 🔍 Checking Supabase session");
        // Memanggil Supabase untuk cek session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          // Error handling without console.log
          console.error("[Index] 🚨 Supabase session error:", error.message);
          setLoadingMessage(`Error: ${error.message}`);
        }

        if (session?.user) {
          console.log("[Index] ✅ Valid session found, user:", session.user.id);
          setLoadingMessage("Session found");
          setUser(session.user);
          console.log("[Index] 🏠 Navigating to Dashboard");
          router.replace("/Dashboard");
        } else {
          console.log("[Index] ❌ No valid session, redirecting to auth");
          router.replace("/auth/AuthSelector");
        }
      } catch (authError) {
        // Tangani error tak terduga
        console.error("[Index] 💥 Unexpected error during auth check:", authError);
        setLoadingMessage("Error occurred while checking session");
      } finally {
        console.log("[Index] 🏁 Authentication check completed");
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser, requiresSafeInit]);

  // Use safe loading screen for Transsion devices
  if (requiresSafeInit) {
    console.log("[Index] 🛡️ Using safe loading screen for Transsion device");
    return (
      <>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <SafeLoadingScreen message={loadingMessage} />
      </>
    );
  }

  console.log("[Index] ⚡ Using standard UI for non-Transsion device");
  return (
    <>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center p-4">
        <Text className="mb-4 text-xl font-bold">{loadingMessage}</Text>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    </>
  );
}
