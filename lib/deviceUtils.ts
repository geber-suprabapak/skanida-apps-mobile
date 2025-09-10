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
    console.log("[DeviceUtils] Non-Android platform detected, skipping Transsion check");
    return false;
  }

  const deviceModel = Constants.deviceName?.toLowerCase() || "";
  const brand = Constants.brand?.toLowerCase() || "";
  const manufacturer = Constants.manufacturer?.toLowerCase() || "";

  console.log("[DeviceUtils] Device detection info:", {
    deviceModel: Constants.deviceName,
    brand: Constants.brand,
    manufacturer: Constants.manufacturer,
    platformVersion: Platform.Version,
  });

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

  const isTranssion = (
    transsionBrands.some(
      (brandName) =>
        brand.includes(brandName) ||
        manufacturer.includes(brandName) ||
        deviceModel.includes(brandName),
    ) || transsionKeywords.some((keyword) => deviceModel.includes(keyword))
  );

  if (isTranssion) {
    console.log("[DeviceUtils] ⚠️ Transsion device detected! Safe initialization mode will be used.");
    console.log("[DeviceUtils] Device details:", {
      deviceModel,
      brand,
      manufacturer,
      matchedKeywords: transsionKeywords.filter(keyword => deviceModel.includes(keyword)),
      matchedBrands: transsionBrands.filter(brandName => 
        brand.includes(brandName) || manufacturer.includes(brandName) || deviceModel.includes(brandName)
      ),
    });
  } else {
    console.log("[DeviceUtils] ✅ Non-Transsion device detected, using standard initialization");
  }

  return isTranssion;
}

/**
 * Check if device requires safe NativeWind initialization
 * (Progressive loading to avoid native UI rendering conflicts)
 */
export function requiresSafeNativeWindInit(): boolean {
  const requiresSafe = isTranssionDevice();
  console.log(`[DeviceUtils] Safe NativeWind initialization required: ${requiresSafe}`);
  return requiresSafe;
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
