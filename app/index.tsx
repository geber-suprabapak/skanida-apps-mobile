// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase, ensureSupabaseInitialized } from "../utils/supabase";
import { getSupabaseConfig } from "~/utils/secureConfig";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Ensure Supabase is initialized with runtime config
        const cfg = await getSupabaseConfig();
        await ensureSupabaseInitialized();

        const sessionResponse = await supabase.auth.getSession();

        const {
          data: { session },
          error,
        } = sessionResponse;

        if (error) {
          setLoadingMessage(`Error: ${error.message}`);
        }

        if (session?.user) {
          setLoadingMessage("Session found");
          setUser(session.user);
          router.replace("/Dashboard");
        } else {
          router.replace("/auth/AuthSelector");
        }
      } catch (err) {
        if (err instanceof Error) {
          setLoadingMessage(
            `Error occurred while checking session: ${err.message}`,
          );
        } else {
          setLoadingMessage("Error occurred while checking session (unknown)");
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

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
