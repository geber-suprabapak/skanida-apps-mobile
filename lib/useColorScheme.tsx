import { useColorScheme as useNativewindColorScheme } from "nativewind";
import { useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLOR_SCHEME_KEY = "skanida_color_scheme";

export function useColorScheme() {
  const {
    colorScheme,
    setColorScheme: nativeSetColorScheme,
    toggleColorScheme: nativeToggleColorScheme,
  } = useNativewindColorScheme();

  // On mount, try to restore saved preference. If none, do nothing and allow
  // nativewind to follow system preference.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
        if (stored === "light" || stored === "dark") {
          // Only call native setter if different from current
          if (stored !== colorScheme) {
            nativeSetColorScheme(stored);
          }
        }
      } catch (err) {
        // non-fatal; fallback to native behavior

        console.warn("useColorScheme: failed to load stored theme", err);
      }
    })();
    // Intentionally run only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wrap native setter so we persist selection
  const setColorScheme = useCallback(
    async (value: "light" | "dark") => {
      try {
        await AsyncStorage.setItem(COLOR_SCHEME_KEY, value);
      } catch (err) {
        console.warn("useColorScheme: failed to save theme", err);
      }
      nativeSetColorScheme(value);
    },
    [nativeSetColorScheme],
  );

  const toggleColorScheme = useCallback(async () => {
    const newValue = colorScheme === "dark" ? "light" : "dark";
    await setColorScheme(newValue);
  }, [colorScheme, setColorScheme]);

  return {
    colorScheme: colorScheme ?? "dark",
    isDarkColorScheme: colorScheme === "dark",
    setColorScheme,
    toggleColorScheme,
  };
}
