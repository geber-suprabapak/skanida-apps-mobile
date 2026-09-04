import "~/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import ConnectionChecker from "~/components/ConnectionChecker";
import { useEffect, useState } from "react";
import { Uniwind, useUniwind } from "uniwind";
import useThemeStore from "~/store/themeStore";
import { timeSync } from "~/utils/timeSync";
import {
  setupNotificationHandler,
  setupNotificationChannel,
} from "~/utils/notifications";
import { useNotificationSync } from "~/hooks/useNotificationSync";
import { getLogtoUser } from "~/utils/logto";
import { View, ActivityIndicator } from "react-native";
import { Text } from "~/components/ui/text";
import useAuthStore from "~/store/authStore";

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  enableTombstone: true,
  tracesSampleRate: 0.1,
  // Keep Hermes profiling off during the Expo 57 rollout to mitigate the
  // known Sentry/Hermes teardown SIGABRT race.
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,

  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
    }),
    Sentry.feedbackIntegration(),
  ],
  spotlight: __DEV__,
});

export { ErrorBoundary } from "expo-router";

export default Sentry.wrap(function RootLayout() {
  const { theme } = useThemeStore();
  const { theme: resolvedTheme } = useUniwind();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    Uniwind.setTheme(theme);
  }, [theme]);

  // Restore the Logto session before rendering routes.
  useEffect(() => {
    let mounted = true;

    async function initializeApp() {
      try {
        const restoredUser = await getLogtoUser();
        if (!mounted) return;
        setUser(restoredUser);
        setIsAuthReady(true);
      } catch (error) {
        if (__DEV__) console.error("Identity initialization failed:", error);
        Sentry.captureException(error);
        if (mounted) {
          setInitError(
            error instanceof Error ? error.message : "Failed to initialize app",
          );
          setIsAuthReady(true);
        }
        return;
      }

      try {
        await timeSync.initialize();
      } catch (error) {
        if (__DEV__) console.warn("TimeSync initialization failed:", error);
        Sentry.captureException(error);
      }

      if (!mounted) return;
      try {
        setupNotificationHandler();
        await setupNotificationChannel();
      } catch (error) {
        if (__DEV__) console.warn("Notification setup failed:", error);
        Sentry.captureException(error);
      }
    }

    initializeApp();

    return () => {
      mounted = false;
      timeSync.cleanup();
    };
  }, [setUser]);

  useNotificationSync({ userId: user?.id, enabled: isAuthReady });

  // Show loading screen while initializing
  if (!isAuthReady) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center bg-background">
          {initError ? (
            <View className="items-center px-8">
              <Text
                variant="h3"
                className="text-red-600 dark:text-red-500 mb-2"
              >
                Initialization Error
              </Text>
              <Text className="text-center text-muted-foreground">
                {initError}
              </Text>
            </View>
          ) : (
            <View className="items-center">
              <ActivityIndicator size="large" color="#0066FF" />
              <Text className="mt-4 text-muted-foreground">
                Initializing...
              </Text>
            </View>
          )}
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConnectionChecker>
        <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{ gestureEnabled: true, headerBackTitle: "Kembali" }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="attendance/AbsenceReport"
            options={{ title: "Lapor Absensi" }}
          />
          <Stack.Screen
            name="attendance/CameraAttendance"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="profile/ManageAccount"
            options={{ title: "Kelola Akun" }}
          />
          <Stack.Screen
            name="profile/enroll"
            options={{ title: "Pendaftaran Wajah" }}
          />
          <Stack.Screen
            name="perizinan/izin"
            options={{ title: "Pengajuan Izin" }}
          />
          <Stack.Screen
            name="perizinan/status"
            options={{ title: "Status Perizinan" }}
          />
        </Stack>
        <PortalHost />
      </ConnectionChecker>
    </SafeAreaProvider>
  );
});
