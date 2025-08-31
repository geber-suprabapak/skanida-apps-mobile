const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: ["dist/*", "node_modules/*", "android/*", "ios/*", ".expo/*"],
  },
]);
// This configuration extends the Expo ESLint config and includes Prettier's recommended settings.
