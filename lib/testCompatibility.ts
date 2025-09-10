// lib/testCompatibility.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import { isTecnoDevice, shouldUseSafeMode } from "./deviceCompatibility";

/**
 * Test function to verify device compatibility detection
 */
export function testDeviceCompatibility(): void {
  console.log("=== Device Compatibility Test ===");

  try {
    // Basic device info
    console.log("Platform:", Platform.OS);
    console.log("Device Name:", Constants.deviceName);
    console.log("Brand:", Constants.brand);
    console.log("Manufacturer:", Constants.manufacturer);
    console.log("System Version:", Constants.systemVersion);

    // Test TECNO detection
    const isTecno = isTecnoDevice();
    console.log("Is TECNO device:", isTecno);

    // Test safe mode
    const useSafeMode = shouldUseSafeMode();
    console.log("Should use safe mode:", useSafeMode);

    // Log compatibility decision
    if (useSafeMode) {
      console.log("✅ Safe mode will be enabled for this device");
      console.log("- NativeWind color scheme will be limited to light mode");
      console.log("- Complex styles will be simplified");
      console.log("- Startup delay will be added for stability");
    } else {
      console.log("✅ Full NativeWind features available for this device");
    }
  } catch (error) {
    console.error("Error during device compatibility test:", error);
  }

  console.log("=== End Device Compatibility Test ===");
}

/**
 * Mock TECNO device for testing
 */
export function mockTecnoDevice(): void {
  // Override device info for testing
  (Constants as any).deviceName = "TECNO KL4";
  (Constants as any).brand = "TECNO";
  (Constants as any).manufacturer = "TECNO Mobile Limited";

  console.log("🧪 Device mocked as TECNO KL4 for testing");
  testDeviceCompatibility();
}

/**
 * Reset device mock
 */
export function resetDeviceMock(): void {
  // This would need to restore original values in a real implementation
  console.log("🔄 Device mock reset (restart app for full reset)");
}
