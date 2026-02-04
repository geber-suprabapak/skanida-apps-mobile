import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Skanida Apps",
  slug: "skanida-apps-mobile",
  version: "1.2.0-development",
  runtimeVersion: {
    policy: "appVersion",
  },
  scheme: "skanida-apps-mobile",
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  newArchEnabled: true,
  updates: {
    url: "https://ota.hysilens.my.id/manifest",
    codeSigningMetadata: {
      keyid: "main",
      alg: "rsa-v1_5-sha256",
    },
    codeSigningCertificate: "./certs/certificate.pem",
    enabled: true,
    requestHeaders: {
      "expo-channel-name": process.env.RELEASE_CHANNEL || "production",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-camera",
      {
        cameraPermission: "Allow $(PRODUCT_NAME) to access your camera",
      },
    ],
    "expo-web-browser",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "skanida-apps-mobile",
        organization: "geber-suprabapak",
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "$(PRODUCT_NAME) needs access to your Camera.",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          enableBundleCompression: true,
          enableMinifyInReleaseBuilds: true,
          useLegacyPackaging: true,
          targetSdkVersion: 35,
        },
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
    "expo-font",
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.hfzrk.skanidaappsmobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    // NOTE: Using .dev suffix for development builds. This will install as a
    // separate app alongside production builds. Update to production package
    // name (com.hfzrk.skanidaappsmobile) for release builds.
    package: "com.hfzrk.skanidaappsmobile.dev",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
    ],
  },
  extra: {
    router: {
      origin: false,
    },
    eas: {
      projectId: "a423f8e9-23fd-472b-b405-f5ef8f726bf9",
    },
  },
  owner: "geber-suprabapak",
});
