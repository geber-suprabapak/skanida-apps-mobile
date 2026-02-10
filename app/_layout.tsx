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
  dsn: "https://a6b6f7f50d7448b1d36d85f74336a3e4@o4509587174522880.ingest.de.sentry.io/4509587182321744",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // PERF-C02: Reduce sample rates in production to avoid 10-30% CPU overhead
  tracesSampleRate: __DEV__ ? 1.0 : 0.05, // 5% in production
  profilesSampleRate: __DEV__ ? 1.0 : 0.01, // 1% in production

  // Configure Session Replay - disable session replay in production for performance
  replaysSessionSampleRate: __DEV__ ? 0.1 : 0,
  replaysOnErrorSampleRate: __DEV__ ? 1 : 0.1, // 10% error replay in production
  integrations: [
    ...(__DEV__ ? [Sentry.mobileReplayIntegration()] : []),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
  _experiments: { enableLogs: true },
});

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export default Sentry.wrap(function RootLayout() {
  const { theme } = useThemeStore();

  // Initialize theme from store on app load
  useEffect(() => {
    if (theme === "system") {
      // Reset to system preference (defaults to light)
      colorScheme.set("light");
    } else {
      colorScheme.set(theme);
    }
  }, [theme]);

  // Initialize time sync on app start
  useEffect(() => {
    timeSync.initialize().catch((error) => {
      console.error("TimeSync initialization failed:", error);
    });

    // Cleanup on unmount
    return () => {
      timeSync.cleanup();
    };
  }, []);

  // Setup notification handler for foreground notifications
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
