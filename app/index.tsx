// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";
import ConsoleLogger from "~/components/ConsoleLogger";

export default function Index() {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("Starting auth check...");
        // Memanggil Supabase untuk cek session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log("Auth error:", error.message);
          // Error handling without console.log
          setLoadingMessage(`Error: ${error.message}`);
        }

        if (session?.user) {
          console.log("Session found for user:", session.user.id);
          setLoadingMessage("Session found");
          setUser(session.user);
          router.replace("/Dashboard");
        } else {
          console.log("No session found, redirecting to auth");
          router.replace("/auth/AuthSelector");
        }
      } catch (err) {
        console.log("Unexpected error in checkAuth:", err);
        // Tangani error tak terduga
        setLoadingMessage("Error occurred while checking session");
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
        <ConsoleLogger />
      </View>
    </>
  );
}
