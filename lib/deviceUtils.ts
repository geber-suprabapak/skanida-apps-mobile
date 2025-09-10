import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Utility functions for device detection and compatibility
 */

/**
 * Check if the current device is a Transsion device (Infinix, Tecno, Itel)
 * These devices are known to have issues with complex NativeWind initialization
 */
export function isTranssionDevice(): boolean {
  if (Platform.OS !== "android") {
    return false;
  }

  const deviceModel = Constants.deviceName?.toLowerCase() || "";
  const brand = Constants.brand?.toLowerCase() || "";
  const manufacturer = Constants.manufacturer?.toLowerCase() || "";

  // Check for Transsion brands
  const transsionBrands = ["tecno", "infinix", "itel"];
  const transsionKeywords = [
    "tecno",
    "infinix",
    "itel",
    "kl4",
    "x657c",
    "x688b",
  ];

  return (
    transsionBrands.some(
      (brandName) =>
        brand.includes(brandName) ||
        manufacturer.includes(brandName) ||
        deviceModel.includes(brandName),
    ) || transsionKeywords.some((keyword) => deviceModel.includes(keyword))
  );
}

/**
 * Check if device requires safe NativeWind initialization
 * (Progressive loading to avoid native UI rendering conflicts)
 */
export function requiresSafeNativeWindInit(): boolean {
  return isTranssionDevice();
}

/**
 * Get device info for debugging
 */
export function getDeviceDebugInfo() {
  return {
    platform: Platform.OS,
    platformVersion: Platform.Version,
    deviceName: Constants.deviceName,
    brand: Constants.brand,
    manufacturer: Constants.manufacturer,
    isTranssionDevice: isTranssionDevice(),
    requiresSafeInit: requiresSafeNativeWindInit(),
  };
}
