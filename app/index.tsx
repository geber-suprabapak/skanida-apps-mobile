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

        const sessionResponse = await supabase.auth.getSession();
        console.log("Supabase getSession response:", {
          sessionExists: !!sessionResponse.data.session,
          userId: sessionResponse.data.session?.user?.id ?? null,
          expiresAt: sessionResponse.data.session?.expires_at ?? null,
          hasError: !!sessionResponse.error,
          errorName: sessionResponse.error?.name ?? null,
          errorMessage: sessionResponse.error?.message ?? null,
        });

        const {
          data: { session },
          error,
        } = sessionResponse;

        if (error) {
          console.log("Auth error details:", {
            name: error.name,
            message: error.message,
            status: (error as unknown as { status?: number })?.status ?? null,
          });
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
        if (err instanceof Error) {
          console.log("Unexpected error in checkAuth (Error instance):", {
            name: err.name,
            message: err.message,
            stack: err.stack,
          });
          setLoadingMessage(
            `Error occurred while checking session: ${err.message}`,
          );
        } else {
          console.log("Unexpected error in checkAuth (non-Error):", err);
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
        <ConsoleLogger />
      </View>
    </>
  );
}
