// lib/safeColorScheme.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { shouldUseSafeMode } from './deviceCompatibility';

export type SafeColorScheme = 'light' | 'dark';

interface SafeColorSchemeContextType {
  colorScheme: SafeColorScheme;
  isDarkColorScheme: boolean;
  setColorScheme: (scheme: SafeColorScheme) => void;
  toggleColorScheme: () => void;
  isSafeMode: boolean;
}

const SafeColorSchemeContext = createContext<SafeColorSchemeContextType | undefined>(undefined);

const COLOR_SCHEME_KEY = 'user-color-scheme';

export function SafeColorSchemeProvider({ children }: { children: React.ReactNode }) {
  const isSafeMode = shouldUseSafeMode();
  const [colorScheme, setColorSchemeState] = useState<SafeColorScheme>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved color scheme preference
  useEffect(() => {
    const loadColorScheme = async () => {
      try {
        // For safe mode devices, always start with light theme to avoid rendering issues
        if (isSafeMode) {
          setColorSchemeState('light');
          setIsLoaded(true);
          return;
        }

        const saved = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
        if (saved && (saved === 'light' || saved === 'dark')) {
          setColorSchemeState(saved);
        } else {
          // Fallback to system preference for non-safe mode devices
          const systemScheme = Appearance.getColorScheme();
          setColorSchemeState(systemScheme === 'dark' ? 'dark' : 'light');
        }
      } catch (error) {
        console.warn('Failed to load color scheme:', error);
        setColorSchemeState('light');
      } finally {
        setIsLoaded(true);
      }
    };

    loadColorScheme();
  }, [isSafeMode]);

  // Listen to system changes (only for non-safe mode devices)
  useEffect(() => {
    if (isSafeMode) return;

    const listener = Appearance.addChangeListener(({ colorScheme: newScheme }) => {
      // Only auto-switch if user hasn't manually set a preference
      AsyncStorage.getItem(COLOR_SCHEME_KEY).then((saved) => {
        if (!saved) {
          setColorSchemeState(newScheme === 'dark' ? 'dark' : 'light');
        }
      });
    });

    return () => listener?.remove();
  }, [isSafeMode]);

  const setColorScheme = async (scheme: SafeColorScheme) => {
    // For safe mode devices, only allow light theme
    if (isSafeMode && scheme === 'dark') {
      console.warn('Dark mode disabled for device compatibility');
      return;
    }

    setColorSchemeState(scheme);
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
    } catch (error) {
      console.warn('Failed to save color scheme:', error);
    }
  };

  const toggleColorScheme = () => {
    // For safe mode devices, don't allow toggling to dark mode
    if (isSafeMode) {
      console.warn('Theme switching disabled for device compatibility');
      return;
    }

    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    setColorScheme(newScheme);
  };

  const value: SafeColorSchemeContextType = {
    colorScheme,
    isDarkColorScheme: colorScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
    isSafeMode,
  };

  // Don't render children until color scheme is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <SafeColorSchemeContext.Provider value={value}>
      {children}
    </SafeColorSchemeContext.Provider>
  );
}

export function useSafeColorScheme() {
  const context = useContext(SafeColorSchemeContext);
  if (context === undefined) {
    throw new Error('useSafeColorScheme must be used within a SafeColorSchemeProvider');
  }
  return context;
}