// filepath: app/index.tsx
import { useRouter, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";

import useAuthStore from "../store/authStore";
import { supabase } from "../utils/supabase";
import { shouldUseSafeMode } from "../lib/deviceCompatibility";
import { useSafeColorScheme } from "../lib/safeColorScheme";
import { useColorScheme } from "../lib/useColorScheme";

type IndexCommonProps = {
  isDarkColorScheme: boolean;
  isSafeMode: boolean;
};

function IndexCommon({ isDarkColorScheme, isSafeMode }: IndexCommonProps) {
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

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
      } catch {
        setLoadingMessage("Error occurred while checking session");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser]);

  // Use safe styling for problematic devices
  const backgroundClass = isSafeMode
    ? isDarkColorScheme
      ? "bg-gray-900"
      : "bg-white"
    : "";

  const textClass = isSafeMode
    ? isDarkColorScheme
      ? "text-white mb-4 text-xl font-bold"
      : "text-gray-900 mb-4 text-xl font-bold"
    : "mb-4 text-xl font-bold";

  return (
    <>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <View
        className={`flex-1 items-center justify-center p-4 ${backgroundClass}`}
      >
        <Text className={textClass}>{loadingMessage}</Text>
        <ActivityIndicator
          size="large"
          color={isDarkColorScheme ? "#60a5fa" : "#3b82f6"}
        />
        {isSafeMode && (
          <Text
            className={`mt-4 text-sm text-center ${isDarkColorScheme ? "text-gray-400" : "text-gray-600"}`}
          >
            Safe mode enabled for device compatibility
          </Text>
        )}
      </View>
    </>
  );
}

function IndexSafe() {
  const { isDarkColorScheme } = useSafeColorScheme();
  return (
    <IndexCommon isDarkColorScheme={isDarkColorScheme} isSafeMode={true} />
  );
}

function IndexRegular() {
  const { isDarkColorScheme } = useColorScheme();
  return (
    <IndexCommon isDarkColorScheme={isDarkColorScheme} isSafeMode={false} />
  );
}

export default function Index() {
  const isSafeMode = shouldUseSafeMode();
  return isSafeMode ? <IndexSafe /> : <IndexRegular />;
}
