/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
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
