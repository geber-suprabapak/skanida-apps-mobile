// app/SafeAppWrapper.tsx
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { shouldUseSafeMode } from '~/lib/deviceCompatibility';
import { SafeColorSchemeProvider } from '~/lib/safeColorScheme';

interface SafeAppWrapperProps {
  children: React.ReactNode;
}

export function SafeAppWrapper({ children }: SafeAppWrapperProps) {
  const isSafeMode = shouldUseSafeMode();

  // Add startup delay for safe mode devices to allow system to stabilize
  const [isReady, setIsReady] = React.useState(!isSafeMode);

  useEffect(() => {
    if (isSafeMode) {
      // Add a small delay to allow TECNO devices to stabilize
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 500); // 500ms delay for TECNO devices

      return () => clearTimeout(timer);
    }
  }, [isSafeMode]);

  if (!isReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#ffffff' 
      }}>
        <Text style={{ 
          fontSize: 16, 
          color: '#374151',
          marginBottom: 8 
        }}>
          Skanida Apps
        </Text>
        <Text style={{ 
          fontSize: 12, 
          color: '#6b7280' 
        }}>
          Optimizing for your device...
        </Text>
      </View>
    );
  }

  if (isSafeMode) {
    return (
      <SafeColorSchemeProvider>
        {children}
      </SafeColorSchemeProvider>
    );
  }

  return <>{children}</>;
}