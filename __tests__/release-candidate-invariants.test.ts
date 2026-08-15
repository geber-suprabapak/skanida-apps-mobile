import { readFileSync } from "node:fs";
import { join } from "node:path";
import getAppConfig from "../app.config";
import useThemeStore from "../store/themeStore";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

describe("Release candidate v1.3.0 invariants", () => {
  const rootDir = process.cwd();
  const mockContext = {
    projectRoot: rootDir,
    staticConfigPath: join(rootDir, "app.json"),
    packageJsonPath: join(rootDir, "package.json"),
    config: {},
  };

  describe("Application configuration seam", () => {
    it("reports version 1.3.0, appVersion policy, automatic theme, and native platforms", () => {
      const config = getAppConfig(mockContext);

      expect(config.version).toBe("1.3.0");
      expect(config.runtimeVersion).toEqual({ policy: "appVersion" });
      expect(config.userInterfaceStyle).toBe("automatic");
      expect(config.platforms).toEqual(["ios", "android"]);
      expect(config.platforms).not.toContain("web");
    });

    it("configures SDK 57 Android and iOS build properties", () => {
      const config = getAppConfig(mockContext);
      const plugins = config.plugins || [];

      const buildPropsPlugin = plugins.find(
        (p) => Array.isArray(p) && p[0] === "expo-build-properties",
      ) as
        | [
            string,
            {
              android?: Record<string, unknown>;
              ios?: Record<string, unknown>;
            },
          ]
        | undefined;

      expect(buildPropsPlugin).toBeDefined();
      expect(buildPropsPlugin?.[1]?.android?.targetSdkVersion).toBe(36);
      expect(buildPropsPlugin?.[1]?.android?.minSdkVersion).toBe(24);
      expect(buildPropsPlugin?.[1]?.ios?.deploymentTarget).toBe("16.4");
    });
  });

  describe("Dependency graph seam", () => {
    it("excludes removed packages and web runtime dependencies", () => {
      const pkgPath = join(rootDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const forbiddenPackages = [
        "nativewind",
        "react-native-css-interop",
        "react-dom",
        "react-native-web",
        "react-native-worklets-core",
        "@react-navigation/native",
        "@rn-primitives/table",
        "@rn-primitives/types",
      ];

      for (const forbidden of forbiddenPackages) {
        expect(allDeps[forbidden]).toBeUndefined();
      }
    });

    it("pins required Expo SDK 57 and UniWind runtime dependencies", () => {
      const pkgPath = join(rootDir, "package.json");
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

      expect(pkg.version).toBe("1.3.0");
      expect(pkg.dependencies["uniwind"]).toBeDefined();
      expect(pkg.dependencies["react-native-worklets"]).toBe("0.10.1");
      expect(pkg.dependencies["react-native-reanimated"]).toBe("4.5.1");
      expect(pkg.dependencies["react-native"]).toBe("0.86.2");
      expect(pkg.dependencies["react"]).toBe("19.2.3");
      expect(pkg.dependencies["expo"]).toMatch(/~57\.0\./);
    });
  });

  describe("Native project directory seam", () => {
    it("ensures generated native folders android/ and ios/ are not committed", () => {
      const gitignore = readFileSync(join(rootDir, ".gitignore"), "utf8");
      const gitignoreLines = gitignore.split("\n").map((l) => l.trim());

      expect(gitignoreLines).toContain("android");
      expect(gitignoreLines).toContain("ios");
    });
  });

  describe("Theme store persistence seam", () => {
    beforeEach(() => {
      useThemeStore.getState().setTheme("system");
    });

    it("starts with system theme default and updates correctly", () => {
      expect(useThemeStore.getState().theme).toBe("system");

      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().theme).toBe("dark");

      useThemeStore.getState().setTheme("light");
      expect(useThemeStore.getState().theme).toBe("light");

      useThemeStore.getState().setTheme("system");
      expect(useThemeStore.getState().theme).toBe("system");
    });
  });
});
