// Test file to verify device detection and safe initialization
// This can be run manually for testing purposes

import {
  isTranssionDevice,
  requiresSafeNativeWindInit,
  getDeviceDebugInfo,
} from "../lib/deviceUtils";

/**
 * Test function to verify device detection logic
 * Call this from a component during development to test
 */
export function testDeviceDetection() {
  const debugInfo = getDeviceDebugInfo();

  console.log("=== Device Detection Test ===");
  console.log("Device Info:", debugInfo);
  console.log("Is Transsion Device:", isTranssionDevice());
  console.log("Requires Safe Init:", requiresSafeNativeWindInit());
  console.log("============================");

  return debugInfo;
}

/**
 * Mock device info for testing different scenarios
 */
export const mockDeviceScenarios = {
  tecnoKL4: {
    deviceName: "TECNO KL4",
    brand: "TECNO",
    manufacturer: "TRANSSION",
    expected: { isTranssion: true, requiresSafe: true },
  },

  infinixX657C: {
    deviceName: "Infinix X657C",
    brand: "Infinix",
    manufacturer: "TRANSSION",
    expected: { isTranssion: true, requiresSafe: true },
  },

  infinixX688B: {
    deviceName: "Infinix X688B",
    brand: "Infinix",
    manufacturer: "TRANSSION",
    expected: { isTranssion: true, requiresSafe: true },
  },

  samsung: {
    deviceName: "Samsung Galaxy S21",
    brand: "samsung",
    manufacturer: "samsung",
    expected: { isTranssion: false, requiresSafe: false },
  },

  xiaomi: {
    deviceName: "Redmi Note 10",
    brand: "Xiaomi",
    manufacturer: "Xiaomi",
    expected: { isTranssion: false, requiresSafe: false },
  },
};

/**
 * Test all mock scenarios
 */
export function testMockScenarios() {
  console.log("=== Testing Mock Scenarios ===");

  Object.entries(mockDeviceScenarios).forEach(([name, scenario]) => {
    console.log(`\nTesting ${name}:`);
    console.log(`  Device: ${scenario.deviceName}`);
    console.log(`  Brand: ${scenario.brand}`);
    console.log(`  Expected Transsion: ${scenario.expected.isTranssion}`);
    console.log(`  Expected Safe Init: ${scenario.expected.requiresSafe}`);

    // Note: Actual device detection uses expo-constants
    // This is just for documenting expected behavior
  });

  console.log("\n===============================");
}
