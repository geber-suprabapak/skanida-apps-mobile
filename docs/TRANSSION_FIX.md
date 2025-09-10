# Transsion Device Force Close Fix

## Overview

This fix addresses a critical issue where the Skanida Apps Mobile application would force close after ~10 seconds on Transsion devices (Infinix, Tecno, Itel) running Android 14.

## Root Cause

The issue was caused by a `SIGABRT` signal in Android's `libhwui.so` during NativeWind's initial UI rendering. The crash occurred when:

1. App starts and immediately calls `useColorScheme()` from NativeWind
2. NativeWind initializes complex styling operations during app bootstrap
3. TECNO's customized Android 14 UI rendering framework encounters an unhandled state
4. This triggers a native crash in the hardware UI library

## Solution

The fix implements progressive NativeWind initialization for Transsion devices:

### 1. Device Detection (`lib/deviceUtils.ts`)
- Detects Transsion devices (Infinix, Tecno, Itel) by brand, manufacturer, and specific model names
- Includes detection for specific problematic models: KL4, X657C, X688B

### 2. Safe Initialization (`lib/useSafeColorScheme.tsx`)
- Implements a 2-second delay for NativeWind initialization on Transsion devices
- Provides fallback color scheme values during initialization
- Maintains full backward compatibility with existing code

### 3. Safe Loading Screen (`components/SafeLoadingScreen.tsx`)
- Uses inline styles (avoiding NativeWind) for Transsion devices during critical initialization
- Falls back to NativeWind classes for other devices
- Includes debug information display for development

### 4. Error Boundary (`components/NativeWindErrorBoundary.tsx`)
- Catches any remaining UI rendering errors
- Provides graceful fallback UI using inline styles
- Shows helpful error information in development mode

## Device Support

### Affected Devices (Safe Mode Enabled)
- TECNO KL4 (TECNO SPARK Go 1)
- Infinix X657C (Infinix SMART 5)
- Infinix X688B (Infinix HOT Play)
- Other Transsion brand devices

### Unaffected Devices (Normal Mode)
- Samsung devices
- Xiaomi devices
- Google Pixel devices
- Other non-Transsion Android devices

## Testing

To test the device detection logic:

```typescript
import { testDeviceDetection } from "~/tests/deviceDetectionTest";

// Call this in a component during development
testDeviceDetection();
```

## Performance Impact

- **Transsion devices**: 2-second additional loading time during app launch (one-time)
- **Other devices**: No performance impact, existing behavior maintained
- **Memory**: Minimal increase (~5KB for additional components)

## Monitoring

The fix includes Sentry integration for monitoring:
- Device detection results are logged
- Any remaining crashes are captured with device context
- Development mode shows detailed debug information

## Future Improvements

1. **Dynamic delay adjustment**: Could be reduced as Transsion devices update their firmware
2. **Server-side configuration**: Device-specific settings could be managed remotely
3. **Progressive enhancement**: Gradual NativeWind feature enablement after initialization

## Files Modified

- `app/_layout.tsx` - Added safe initialization logic
- `app/index.tsx` - Added Transsion device handling
- `lib/useColorScheme.tsx` - Updated to use safe implementation
- `lib/useSafeColorScheme.tsx` - New safe color scheme hook
- `lib/deviceUtils.ts` - New device detection utilities
- `components/SafeLoadingScreen.tsx` - New safe loading component
- `components/NativeWindErrorBoundary.tsx` - New error boundary
- `tests/deviceDetectionTest.ts` - Test utilities