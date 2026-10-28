import { ExpoConfig, ConfigContext } from "expo/config";
import {
  ConfigPlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withGradleProperties,
} from "expo/config-plugins";

const withSizeOptimizations: ConfigPlugin = (c) => {
  return withGradleProperties(c, (mod) => {
    const keysToRemove = new Set(["expo.gif.enabled", "expo.webp.enabled"]);
    mod.modResults = mod.modResults.filter(
      (item) => !(item.type === "property" && keysToRemove.has(item.key)),
    );
    mod.modResults.push(
      { type: "property", key: "expo.gif.enabled", value: "false" },
      { type: "property", key: "expo.webp.enabled", value: "false" },
    );
    return mod;
  });
};

const withStagingDebugBundle: ConfigPlugin = (config) => {
  const debugBundle =
    process.env.RELEASE_CHANNEL === "staging" &&
    process.env.BUNDLE_STAGING_DEBUG === "1";
  config = withAndroidManifest(config, (mod) => {
    if (debugBundle) return mod;

    const application = mod.modResults.manifest.application?.[0];
    if (!application) throw new Error("Android application manifest missing");
    application["meta-data"] = (application["meta-data"] ?? []).filter(
      ({ $ }) => $["android:name"] !== "EXDevClientEmbeddedBundle",
    );
    return mod;
  });

  return withAppBuildGradle(config, (mod) => {
    const marker =
      "    // k8s-staging: bundled debug artifact\n    debuggableVariants = []\n";
    let contents = mod.modResults.contents;
    const markerCount = contents.split(marker).length - 1;
    if (markerCount > 1)
      throw new Error("Duplicate staging debug bundle marker");
    contents = contents.split(marker).join("");

    if (debugBundle) {
      const anchor = "react {\n";
      if (contents.split(anchor).length - 1 !== 1) {
        throw new Error("Unable to locate React Native Gradle configuration");
      }
      contents = contents.replace(anchor, `${anchor}${marker}`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
};

const stagingDebugDevClientPlugin: [string, { embeddedBundle: boolean }] = [
  "expo-dev-client",
  { embeddedBundle: true },
];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name:
    process.env.RELEASE_CHANNEL === "staging"
      ? "Skanida Apps (Staging)"
      : "Skanida Apps",
  slug: "skanida-apps-mobile",
  version: "1.3.0",
  runtimeVersion: {
    policy: "appVersion",
  },
  scheme: "skanida",
  platforms: ["ios", "android"],
  updates: {
    url: "https://ota.hysilens.my.id/manifest",
    codeSigningMetadata: {
      keyid: "main",
      alg: "rsa-v1_5-sha256",
    },
    codeSigningCertificate: "./certs/certificate.pem",
    enabled: false,
    requestHeaders: {
      "expo-channel-name": process.env.RELEASE_CHANNEL || "production",
    },
  },
  plugins: [
    ...(process.env.RELEASE_CHANNEL === "staging" &&
    process.env.BUNDLE_STAGING_DEBUG === "1"
      ? [stagingDebugDevClientPlugin]
      : []),
    "expo-router",
    "expo-secure-store",
    "expo-web-browser",
    [
      "@sentry/react-native/expo",
      {
        url: "https://sentry.io/",
        project: "skanida-apps-mobile",
        organization: "geber-suprabapak",
        experimental_android: {
          enableAndroidGradlePlugin: true,
        },
      },
    ],
    [
      "react-native-vision-camera",
      {
        cameraPermissionText: "$(PRODUCT_NAME) needs access to your Camera.",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: process.env.RELEASE_CHANNEL === "staging",
          minSdkVersion: 24,
          enableBundleCompression: true,
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          useLegacyPackaging: true,
          networkInspector: false,
          targetSdkVersion: 36,
          packagingOptions: {
            exclude: [
              "org/bouncycastle/pqc/**",
              "org/bouncycastle/x509/**",
              "META-INF/INDEX.LIST",
              "META-INF/*.version",
            ],
          },
        },
        ios: {
          deploymentTarget: "16.4",
        },
      },
    ],
    // SAFETY: Expo runs this typed ConfigPlugin at config evaluation; ExpoConfig's plugins type only models package string/tuple forms.
    withSizeOptimizations as any,
    // SAFETY: ExpoConfig's plugins type does not accept a typed inline ConfigPlugin.
    withStagingDebugBundle as any,
    [
      "expo-notifications",
      {
        icon: "./assets/icon.png",
        color: "#0066FF",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    tsconfigPaths: true,
  },
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  // PERF-M06: Only bundle essential assets (only *.png needed by runtime)
  assetBundlePatterns: ["assets/*.png"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.hfzrk.skanidaappsmobile",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.hfzrk.skanidaappsmobile",
    googleServicesFile: "./certs/google-services.json",
    permissions: [
      "android.permission.CAMERA",
      "android.permission.POST_NOTIFICATIONS",
    ],
  },
  extra: {
    isStaging: process.env.RELEASE_CHANNEL === "staging",
    router: {
      origin: false,
    },
    eas: {
      projectId: "a423f8e9-23fd-472b-b405-f5ef8f726bf9",
    },
  },
  owner: "geber-suprabapak",
});
