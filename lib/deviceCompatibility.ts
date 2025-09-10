// lib/deviceCompatibility.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface DeviceInfo {
  manufacturer?: string;
  model?: string;
  brand?: string;
  isAndroid: boolean;
}

export function getDeviceInfo(): DeviceInfo {
  return {
    manufacturer: Constants.manufacturer || undefined,
    model: Constants.deviceName || undefined,
    brand: Constants.brand || Platform.OS,
    isAndroid: Platform.OS === 'android'
  };
}

/**
 * Check if the current device is a TECNO device
 * TECNO devices are known to have compatibility issues with NativeWind on Android 14
 */
export function isTecnoDevice(): boolean {
  try {
    const deviceInfo = getDeviceInfo();
    
    if (!deviceInfo.isAndroid) {
      return false;
    }

    // Check for TECNO device indicators
    const deviceName = (Constants.deviceName || '').toLowerCase();
    const brand = (Constants.brand || '').toLowerCase();
    const manufacturer = (Constants.manufacturer || '').toLowerCase();

    // Common TECNO identifiers
    const tecnoIdentifiers = [
      'tecno',
      'kl4', // TECNO KL4 specifically mentioned in the issue
      'infinix', // TECNO's sub-brand
      'itel' // Another TECNO sub-brand
    ];

    return tecnoIdentifiers.some(identifier => 
      deviceName.includes(identifier) || 
      brand.includes(identifier) || 
      manufacturer.includes(identifier)
    );
  } catch (error) {
    // If we can't determine device info, assume it's safe (not TECNO)
    console.warn('Could not determine device compatibility:', error);
    return false;
  }
}

/**
 * Check if the device has known compatibility issues with NativeWind
 */
export function hasNativeWindCompatibilityIssues(): boolean {
  return isTecnoDevice();
}

/**
 * Check if we should use safe mode (limited NativeWind features) for this device
 */
export function shouldUseSafeMode(): boolean {
  return hasNativeWindCompatibilityIssues();
}