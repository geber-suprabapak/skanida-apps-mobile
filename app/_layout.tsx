import "~/global.css";

import {
  Theme,
  ThemeProvider,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoadingScreen from "./auth/LoadingScreen";
import ConnectionChecker from "~/components/ConnectionChecker";
import { SafeLoadingScreen } from "~/components/SafeLoadingScreen";
import { NativeWindErrorBoundary } from "~/components/NativeWindErrorBoundary";
import { requiresSafeNativeWindInit } from "~/lib/deviceUtils";

import { NAV_THEME } from "~/lib/constants";
import { useSafeColorScheme } from "~/lib/useSafeColorScheme";
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://a6b6f7f50d7448b1d36d85f74336a3e4@o4509587174522880.ingest.de.sentry.io/4509587182321744",

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,

  // Configure Session Replay
  replaysSessionSampleRate: 1,
  replaysOnErrorSampleRate: 1,
  integrations: [
    Sentry.mobileReplayIntegration(),
    Sentry.feedbackIntegration(),
  ],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
  _experiments: { enableLogs: true },
});

const LIGHT_THEME: Theme = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export default Sentry.wrap(function RootLayout() {
  const hasMounted = React.useRef(false);
  const { isDarkColorScheme, isInitialized } = useSafeColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const requiresSafeInit = requiresSafeNativeWindInit();

  console.log("[RootLayout] App initialization starting");
  console.log("[RootLayout] Requires safe initialization:", requiresSafeInit);
  console.log("[RootLayout] Color scheme initialized:", isInitialized);
  console.log("[RootLayout] Color scheme loaded:", isColorSchemeLoaded);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    console.log("[RootLayout] Component mounting, setting up environment");

    if (Platform.OS === "web") {
      // Adds the background color to the html element to prevent white background on overscroll.
      console.log("[RootLayout] Web platform detected, adding background class");
      document.documentElement.classList.add("bg-background");
    }
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
    
    console.log("[RootLayout] ✅ Layout initialization completed");
  }, []);

  // Show safe loading screen for Transsion devices during NativeWind initialization
  if (requiresSafeInit && (!isColorSchemeLoaded || !isInitialized)) {
    console.log("[RootLayout] 🛡️ Showing safe loading screen for Transsion device");
    console.log("[RootLayout] Color scheme loaded:", isColorSchemeLoaded, "NativeWind initialized:", isInitialized);
    return (
      <SafeLoadingScreen
        message="Initializing app..."
        showDebugInfo={__DEV__}
      />
    );
  }

  // Show regular loading screen until color scheme is loaded for other devices
  if (!isColorSchemeLoaded) {
    console.log("[RootLayout] 📱 Showing regular loading screen for standard device");
    return <LoadingScreen />;
  }

  console.log("[RootLayout] 🚀 App fully initialized, rendering main layout");
  console.log("[RootLayout] Dark mode active:", isDarkColorScheme);

  return (
    <NativeWindErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
          <ConnectionChecker>
            <StatusBar
              style={isDarkColorScheme ? "light" : "dark"}
              backgroundColor="transparent"
              translucent={Platform.OS === "android"}
            />
            <Stack />
          </ConnectionChecker>
        </ThemeProvider>
      </SafeAreaProvider>
    </NativeWindErrorBoundary>
  );
});

// Untuk support server-side rendering di web
const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;
