const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Configure path aliases
config.resolver.alias = {
  "~": path.resolve(__dirname, "./"),
};

module.exports = withNativeWind(config, { input: "./global.css" });