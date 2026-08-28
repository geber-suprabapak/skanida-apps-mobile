import { readFileSync } from "node:fs";
import { join } from "node:path";
import getAppConfig from "../app.config";
import useThemeStore from "../store/themeStore";

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

      type BuildPropsOptions = {
        android?: {
          targetSdkVersion?: number;
          minSdkVersion?: number;
        };
        ios?: {
          deploymentTarget?: string;
        };
      };

      // SAFETY: Expo build properties plugin configuration tuple.
      const buildPropsPlugin = plugins.find(
        (p) => Array.isArray(p) && p[0] === "expo-build-properties",
      ) as [string, BuildPropsOptions] | undefined;

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

  describe("Ecosystem release remediation invariants (ISS-02, ISS-06, ISS-10, ISS-15, ISS-16)", () => {
    it("ISS-02: ensures Login.tsx requests mobile:access scope and includes resource parameter", () => {
      const loginPath = join(rootDir, "app/auth/Login.tsx");
      const content = readFileSync(loginPath, "utf8");

      expect(content).toContain('"mobile:access"');
      expect(content).toContain("resource:");
      expect(content).toContain("EXPO_PUBLIC_LOGTO_RESOURCE");
    });

    it("ISS-06: ensures bffMobileApi.ts normalizes both camelCase and snake_case query params", () => {
      const bffPath = join(rootDir, "utils/bffMobileApi.ts");
      const content = readFileSync(bffPath, "utf8");

      expect(content).toContain('queryParams.append("startDate", startDate)');
      expect(content).toContain('queryParams.append("start_date", startDate)');
      expect(content).toContain('queryParams.append("endDate", endDate)');
      expect(content).toContain('queryParams.append("end_date", endDate)');
    });

    it("ISS-10: ensures Dashboard.tsx handles pending profile lifecycle status gracefully", () => {
      const dashboardPath = join(rootDir, "app/Dashboard.tsx");
      const content = readFileSync(dashboardPath, "utf8");

      expect(content).toContain("isPendingApproval");
      expect(content).toContain("Akun Menunggu Persetujuan");
      expect(content).toContain("Cek Status Persetujuan");
      expect(content).toContain("lifecycle_status");
    });

    it("ISS-15: ensures eas.json contains only relative ./artifacts build artifact paths", () => {
      const easPath = join(rootDir, "eas.json");
      const eas = JSON.parse(readFileSync(easPath, "utf8"));

      type ProfileKey =
        | "preview"
        | "production"
        | "production-ci"
        | "production-armv7a";
      const profiles: ProfileKey[] = [
        "preview",
        "production",
        "production-ci",
        "production-armv7a",
      ];
      for (const profile of profiles) {
        const artifactDir =
          eas.build?.[profile]?.env?.EAS_LOCAL_BUILD_ARTIFACTS_DIR;
        expect(artifactDir).toBe("./artifacts");
      }
    });

    it("ISS-16: ensures timeSync.ts has resilient NTP timeout and fallback", () => {
      const timeSyncPath = join(rootDir, "utils/timeSync.ts");
      const content = readFileSync(timeSyncPath, "utf8");

      expect(content).toContain("new AbortController()");
      expect(content).toContain("controller.abort()");
      expect(content).toContain("WorldTimeAPI");
    });
  });
});
