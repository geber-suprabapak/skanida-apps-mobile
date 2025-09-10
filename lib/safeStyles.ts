// lib/safeStyles.ts
import { shouldUseSafeMode } from './deviceCompatibility';

/**
 * Safe styling utility that provides fallback styles for problematic devices
 */

export interface SafeStyleConfig {
  isSafeMode: boolean;
  colorScheme: 'light' | 'dark';
}

/**
 * Get safe background color classes that avoid complex gradients and shadows
 */
export function getSafeBackgroundClass(
  config: SafeStyleConfig,
  defaultClass: string,
  fallbackClass?: string
): string {
  if (config.isSafeMode) {
    // For safe mode, use simple solid colors
    if (config.colorScheme === 'dark') {
      return fallbackClass || 'bg-gray-900';
    }
    return fallbackClass || 'bg-white';
  }
  return defaultClass;
}

/**
 * Get safe text color classes
 */
export function getSafeTextClass(
  config: SafeStyleConfig,
  defaultClass: string,
  fallbackClass?: string
): string {
  if (config.isSafeMode) {
    // For safe mode, use simple text colors
    if (config.colorScheme === 'dark') {
      return fallbackClass || 'text-white';
    }
    return fallbackClass || 'text-gray-900';
  }
  return defaultClass;
}

/**
 * Get safe border classes that avoid complex borders
 */
export function getSafeBorderClass(
  config: SafeStyleConfig,
  defaultClass: string,
  fallbackClass?: string
): string {
  if (config.isSafeMode) {
    // For safe mode, use simple borders
    if (config.colorScheme === 'dark') {
      return fallbackClass || 'border border-gray-700';
    }
    return fallbackClass || 'border border-gray-200';
  }
  return defaultClass;
}

/**
 * Get safe shadow classes - avoid shadows in safe mode as they can cause rendering issues
 */
export function getSafeShadowClass(
  config: SafeStyleConfig,
  defaultClass: string
): string {
  if (config.isSafeMode) {
    return ''; // No shadows in safe mode
  }
  return defaultClass;
}

/**
 * Create a safe style utility function
 */
export function createSafeStyle(config: SafeStyleConfig) {
  return {
    background: (defaultClass: string, fallbackClass?: string) =>
      getSafeBackgroundClass(config, defaultClass, fallbackClass),
    
    text: (defaultClass: string, fallbackClass?: string) =>
      getSafeTextClass(config, defaultClass, fallbackClass),
    
    border: (defaultClass: string, fallbackClass?: string) =>
      getSafeBorderClass(config, defaultClass, fallbackClass),
    
    shadow: (defaultClass: string) =>
      getSafeShadowClass(config, defaultClass),
    
    // Utility to conditionally apply classes only in non-safe mode
    advanced: (classNames: string) =>
      config.isSafeMode ? '' : classNames,
  };
}

/**
 * Global safe mode check
 */
export const isSafeModeEnabled = shouldUseSafeMode();