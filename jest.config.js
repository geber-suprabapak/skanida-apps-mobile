/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    "^expo-auth-session$": "<rootDir>/__mocks__/expo-auth-session.js",
    "^expo-constants$": "<rootDir>/__mocks__/expo-constants.js",
    "^expo-image$": "<rootDir>/__mocks__/expo-image.js",
    "^expo-notifications$": "<rootDir>/__mocks__/expo-notifications.js",
    "^expo-router$": "<rootDir>/__mocks__/expo-router.ts",
    "^lucide-react-native$": "<rootDir>/__mocks__/lucide-react-native.js",
    "^react-native-reanimated$":
      "<rootDir>/__mocks__/react-native-reanimated.js",
    "^react-native-vision-camera$":
      "<rootDir>/__mocks__/react-native-vision-camera.js",
    "^uniwind$": "<rootDir>/__mocks__/uniwind.tsx",
    "^react-native-safe-area-context$":
      "<rootDir>/__mocks__/react-native-safe-area-context.tsx",
    "^@sentry/react-native$": "<rootDir>/__mocks__/@sentry/react-native.ts",
    "^@/(.*)$": "<rootDir>/$1",
    "^~/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@rn-primitives|@sentry/react-native|native-base|standard-navigation))",
    "/node_modules/react-native-reanimated/plugin/",
  ],
};
