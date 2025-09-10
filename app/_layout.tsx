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
import { SafeAppWrapper } from "./SafeAppWrapper";

import { NAV_THEME } from "~/lib/constants";
import { useColorScheme } from "~/lib/useColorScheme";
import { useSafeColorScheme } from "~/lib/safeColorScheme";
import { shouldUseSafeMode } from "~/lib/deviceCompatibility";
import { testDeviceCompatibility } from "~/lib/testCompatibility";
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

// Inner layout component that uses safe color scheme
function InnerRootLayout() {
  const hasMounted = React.useRef(false);
  const isSafeMode = shouldUseSafeMode();
  
  // Use safe color scheme if in safe mode, otherwise use regular NativeWind color scheme
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
    
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  
  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === "web") {
      // Adds the background color to the html element to prevent white background on overscroll.
      document.documentElement.classList.add("bg-background");
    }
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  // Show loading screen until color scheme is loaded
  if (!isColorSchemeLoaded) {
    return <LoadingScreen />;
  }

  return (
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
  );
}

export default Sentry.wrap(function RootLayout() {
  const isSafeMode = shouldUseSafeMode();

  // Add device compatibility logging
  React.useEffect(() => {
    // Run compatibility test
    testDeviceCompatibility();
    
    if (isSafeMode) {
      console.log('Safe mode enabled for device compatibility');
      Sentry.setTag('safe_mode', true);
      Sentry.setContext('device_compatibility', {
        safe_mode: true,
        reason: 'TECNO device compatibility'
      });
    }
  }, [isSafeMode]);

  return (
    <SafeAppWrapper>
      <InnerRootLayout />
    </SafeAppWrapper>
  );
});

// Untuk support server-side rendering di web
const useIsomorphicLayoutEffect =
  Platform.OS === "web" && typeof window === "undefined"
    ? React.useEffect
    : React.useLayoutEffect;
