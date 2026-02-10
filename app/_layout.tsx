import "~/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PortalHost } from "@rn-primitives/portal";
import ConnectionChecker from "~/components/ConnectionChecker";
import { useEffect } from "react";
import { colorScheme } from "nativewind";
import useThemeStore from "~/store/themeStore";
import { timeSync } from "~/utils/timeSync";
import {
  setupNotificationHandler,
  setupNotificationChannel,
} from "~/utils/notifications";

import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.05,
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

export {
  ErrorBoundary,
} from "expo-router";

export default Sentry.wrap(function RootLayout() {
  const { theme } = useThemeStore();

  useEffect(() => {
    if (theme === "system") {
      colorScheme.set("light");
    } else {
      colorScheme.set(theme);
    }
  }, [theme]);

  useEffect(() => {
    timeSync.initialize().catch((error) => {
      console.error("TimeSync initialization failed:", error);
    });

    return () => {
      timeSync.cleanup();
    };
  }, []);

  useEffect(() => {
    setupNotificationHandler();
    setupNotificationChannel().catch((error) => {
      console.error("Notification channel setup failed:", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <ConnectionChecker>
        <StatusBar style="auto" />
        <Stack />
        <PortalHost />
      </ConnectionChecker>
    </SafeAreaProvider>
  );
});
