const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = withNativeWind(getSentryExpoConfig(__dirname), {
  input: "./global.css",
  inlineRem: 16,
});

// Configure path aliases
config.resolver.alias = {
  "~": path.resolve(__dirname, "./"),
};

module.exports = config;
