// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";
import { shouldUseSafeMode } from "../lib/deviceCompatibility";
import { useSafeColorScheme } from "../lib/safeColorScheme";
import { useColorScheme } from "../lib/useColorScheme";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  
  const isSafeMode = shouldUseSafeMode();
  
  // Use appropriate color scheme hook based on safe mode
  let isDarkColorScheme = false;
  if (isSafeMode) {
    try {
      const safeScheme = useSafeColorScheme();
      isDarkColorScheme = safeScheme.isDarkColorScheme;
    } catch {
      // Fallback if not in provider context
      isDarkColorScheme = false;
    }
  } else {
    const regularColorScheme = useColorScheme();
    isDarkColorScheme = regularColorScheme.isDarkColorScheme;
  }

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Memanggil Supabase untuk cek session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          // Error handling without console.log
          setLoadingMessage(`Error: ${error.message}`);
        }

        if (session?.user) {
          setLoadingMessage("Session found");
          setUser(session.user);
          router.replace("/Dashboard");
        } else {
          router.replace("/auth/AuthSelector");
        }
      } catch {
        // Tangani error tak terduga
        setLoadingMessage("Error occurred while checking session");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

  // Use safe styling for problematic devices
  const backgroundClass = isSafeMode 
    ? (isDarkColorScheme ? "bg-gray-900" : "bg-white")
    : "flex-1 items-center justify-center p-4";
  
  const textClass = isSafeMode
    ? (isDarkColorScheme ? "text-white mb-4 text-xl font-bold" : "text-gray-900 mb-4 text-xl font-bold")
    : "mb-4 text-xl font-bold";

  return (
    <>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <View className={`flex-1 items-center justify-center p-4 ${backgroundClass}`}>
        <Text className={textClass}>{loadingMessage}</Text>
        <ActivityIndicator size="large" color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"} />
        {isSafeMode && (
          <Text className={`mt-4 text-sm text-center ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}>
            Safe mode enabled for device compatibility
          </Text>
        )}
      </View>
    </>
  );
}
