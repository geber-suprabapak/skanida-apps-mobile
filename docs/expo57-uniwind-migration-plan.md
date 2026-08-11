# Expo SDK 57 and UniWind Migration Plan

## Context

Migrate this Expo-managed React Native application from its current Expo SDK 53 baseline to Expo SDK 57, update React Native Reusables to the newest release compatible with that target, and replace NativeWind with UniWind completely. The current manifest pins Expo `~53.0.27`, React `19.0.0`, React Native `0.79.6`, NativeWind `4.1.21`, and `react-native-css-interop` `0.1.20`; it is pnpm-managed and has no committed `android/` or `ios/` directories.

Expo's current SDK 57 compatibility table requires React Native `0.86`, React `19.2.3`, React Native Web `0.21.0`, and Node `22.13.x`; its documented path is to install Expo 57, let `expo install --fix` align Expo-managed packages, run `expo-doctor`, and rebuild generated native projects. The repository currently routes styling through NativeWind's Babel/Metro/Tailwind integration and uses React Native Reusables primitives under `components/ui`; current upstream React Native Reusables supports an explicit UniWind registry mode, so the end state is a clean UniWind component and tooling cutover rather than a NativeWind compatibility layer.

The concrete cutover points are `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `tsconfig.json`, and `components.json`. NativeWind-specific runtime APIs occur in `app/_layout.tsx`, `app/extra/pengaturan.tsx`, `store/themeStore.ts`, `components/ui/pop-up.tsx`, and the `cssInterop`-based `components/ui/icon.tsx`; ordinary `className` use is widespread and semantic tokens such as `bg-background`, `bg-card`, and `text-foreground` are material to the current UI. The current Reusables-style files are `text.tsx`, `button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, and `icon.tsx`; `avatar.tsx`, `pop-up.tsx`, `month-year-picker.tsx`, and `attendance-calendar.tsx` are app-specific components whose public behavior must be retained.

Expo documents this four-SDK jump as an incremental `53 → 54 → 55 → 56 → 57` upgrade. The app uses legacy `expo-file-system` calls in `CameraAttendance.tsx`, `izin.tsx`, and `enroll.tsx`, so those imports must become `expo-file-system/legacy` while adding the package as a direct Expo dependency; SDK 55 removes `newArchEnabled`, SDK 56 decouples Expo Router from React Navigation, and the only `@react-navigation/native` consumer is the otherwise unused `lib/theme.ts`. The current OTA compatibility policy is `runtimeVersion: { policy: "appVersion" }`, so the migration must issue a new valid native app version before publishing any update.

## Approach

### 1. Move the managed runtime from SDK 53 to SDK 54 before introducing UniWind

1. In `package.json`, add `"engines": { "node": ">=22.13.0 <23" }`; retain pnpm `10.19.0`. Keep `.github/workflows/android-apk.yml` on its existing `node-version: "22"` range, which resolves to a supported Node 22 release.
2. Upgrade only one SDK at a time, starting with `pnpm exec expo install expo@^54.0.0 --fix`. Do not jump straight from SDK 53 to 57: Expo’s upgrade workflow explicitly requires an incremental `53 → 54 → 55 → 56 → 57` sequence so each new native/template failure has one identifiable source.
3. At SDK 54, add `expo-file-system` as a direct Expo-managed dependency with `pnpm exec expo install expo-file-system`, then change exactly these legacy consumers to `import * as FileSystem from "expo-file-system/legacy"`: `app/attendance/CameraAttendance.tsx`, `app/perizinan/izin.tsx`, and `app/profile/enroll.tsx`. They call `getInfoAsync`, `readAsStringAsync`, `EncodingType.Base64`, and `deleteAsync`, so keeping the legacy namespace preserves their existing photo validation, base64 upload, and cleanup behavior rather than rewriting file handling during this migration.
4. At the same stage, install the SDK-aligned animation pair with `pnpm exec expo install react-native-reanimated react-native-worklets`. Remove the direct `react-native-worklets-core` dependency and its `react-native-worklets-core/plugin`: the source has no frame processor/worklet-core use, and VisionCamera 4 declares that peer optional. Remove the explicit Reanimated plugin because Expo’s preset configures it automatically, but retain NativeWind’s JSX/preset entries until the atomic UniWind configuration replacement in step 2.
5. In `app.config.ts`, keep `minSdkVersion: 24`, change `expo-build-properties.android.targetSdkVersion` from `35` to `36`, and delete the deprecated `enableProguardInReleaseBuilds` key while retaining `enableMinifyInReleaseBuilds: true`. Run `pnpm dlx expo-doctor@latest` and `pnpm exec tsc --noEmit` before starting the styling cutover; resolve only SDK-54 errors before proceeding.

### 2. Replace NativeWind with UniWind after SDK 54 is healthy

1. Install `uniwind@latest` and `tailwindcss@latest` with pnpm after SDK 54, which supplies React Native `0.81` and therefore meets UniWind’s `react-native >=0.81` peer requirement. Remove `nativewind`, `react-native-css-interop`, and the unused `tailwindcss-animate` plugin once its deleted Tailwind config no longer references it; retain `clsx`, `class-variance-authority`, and `tailwind-merge`, because the reusables components use `cn()`.
2. Replace `metro.config.js`’s `withNativeWind` wrapper with `withUniwindConfig` from `uniwind/metro`. Preserve the existing `getSentryExpoConfig(__dirname)` base and `~` resolver alias, then export exactly the outermost wrapper:

   ```js
   module.exports = withUniwindConfig(config, {
     cssEntryFile: "./global.css",
     dtsFile: "./uniwind-types.d.ts",
   });
   ```

   UniWind must wrap the fully configured Sentry Metro config, not the reverse.
3. Delete `tailwind.config.js` and migrate `global.css` to Tailwind 4/UniWind syntax. Replace the two `@tailwind` directives with `@import "tailwindcss";` and `@import "uniwind";`; retain the current light and dark palette exactly by converting each current `:root` value `--name: <HSL>` to `@variant light { --color-name: hsl(<HSL>); }` and each `.dark:root` value to the equivalent `@variant dark` declaration. Preserve all existing semantic tokens (`background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `muted`, `accent`, `destructive`, `border`, `input`, `ring`, and `chart-1` through `chart-5`) and retain the current radius geometry with:

   ```css
   @theme {
     --radius: 0.625rem;
     --radius-lg: var(--radius);
     --radius-md: calc(var(--radius) - 2px);
     --radius-sm: calc(var(--radius) - 4px);
   }
   ```

   Do not import the upstream `tw-animate-css` template: the only current animation class is Tailwind-core `animate-spin`, and scans show no `animate-accordion-*` or `border-hairline` consumer.
4. Delete `nativewind-env.d.ts`; configure Metro to generate and commit `uniwind-types.d.ts`; replace the explicit `nativewind-env.d.ts` entry in `tsconfig.json` with `uniwind-types.d.ts`. Keep `import "~/global.css"` in `app/_layout.tsx`, because it is already the correct app-level CSS import location.
5. In `components.json`, keep the aliases and CSS path, set `tailwind.config` to the empty string `""` instead of the deleted file, and add `"iconLibrary": "lucide"` to match the current UniWind React Native Reusables template.

### 3. Update every existing React Native Reusables wrapper without redesigning screens

1. Do not run `rnr init` or add the entire catalog. Once UniWind is configured, run:

   ```sh
   pnpm dlx @react-native-reusables/cli@latest add text button badge card input icon --styling-library uniwind --overwrite --yes
   ```

   This is the clean cutover for the six existing registry-owned files only: `components/ui/text.tsx`, `button.tsx`, `badge.tsx`, `card.tsx`, `input.tsx`, and `icon.tsx`.
2. Retain the current visual contract after generation. Preserve the current `textVariants`, `buttonVariants`, `buttonTextVariants`, `badgeVariants`, `badgeTextVariants`, Card class strings, Input default class string, named exports, and the Icon default size of `14`; use current UniWind registry mechanics only where they replace NativeWind mechanics. In particular, implement the generated Icon adapter with `withUniwind(IconImpl, { size: { fromClassName: "className", styleProperty: "width" }, color: { fromClassName: "className", styleProperty: "color" } })`, keep `TextClassContext`, and do not retain any `cssInterop` call.
3. Update the six reusables support packages to current releases with `pnpm up --latest @rn-primitives/portal @rn-primitives/slot class-variance-authority clsx lucide-react-native tailwind-merge`. Remove direct `@rn-primitives/table` and `@rn-primitives/types`: repository scans show neither has a consumer; `PortalHost` and Slot remain required by `app/_layout.tsx`, `text.tsx`, and `badge.tsx`.
4. Keep `avatar.tsx`, `month-year-picker.tsx`, and `attendance-calendar.tsx` as app-owned components. Their ordinary `className` props continue to work under UniWind; alter neither API nor screen consumer. In `pop-up.tsx`, replace NativeWind’s `useColorScheme` with React Native’s hook and use `const isDark = useColorScheme() === "dark"` for the existing conditional backdrop/classes.

### 4. Complete SDK 55, SDK 56, and SDK 57 with their required clean cutovers

1. Run `pnpm exec expo install expo@^55.0.0 --fix`, then remove `newArchEnabled` from `app.config.ts`; SDK 55 removed the option because the New Architecture is mandatory. Run Expo Doctor and TypeScript before advancing.
2. Run `pnpm exec expo install expo@^56.0.0 --fix`, then change `expo-build-properties.ios.deploymentTarget` from `"15.1"` to `"16.4"`. Remove the unused `lib/theme.ts` and direct `@react-navigation/native` dependency: the exact repository scan for `@react-navigation` finds only that file, and SDK 56 decouples Expo Router from React Navigation. Preserve all Expo Router `Stack`, `useRouter`, and `useFocusEffect` imports, which remain the app’s routing API.
3. Run `pnpm exec expo install expo@^57.0.0 --fix`, then run `pnpm dlx expo-doctor@latest`. Accept Expo’s resolved SDK-57 package patch versions rather than hand-pinning individual Expo modules; the final graph must target Expo 57, React Native 0.86, React 19.2.3, and the SDK-aligned Reanimated/Worklets pair.
4. Keep `react-native-vision-camera` on the v4 line while proving the upgrade: it has no frame-processor callsite and its v4 peer ranges accept React Native broadly. Do not upgrade it to v5 merely for this SDK migration because v5 adds Nitro module dependencies and is a separate API migration.

### 5. Make the resulting application native-only and make system theme behavior real

1. In `app.config.ts`, set `version: "1.3.0"`, retain `runtimeVersion: { policy: "appVersion" }`, set `userInterfaceStyle: "automatic"`, add `platforms: ["ios", "android"]`, and remove the full `web` object. Remove direct `react-dom` and `react-native-web` dependencies from `package.json`; do not remove harmless `Platform.select({ web: ... })` branches emitted by upstream reusables source because the Expo platform list and absent web runtime packages are the support boundary.
2. Make `store/themeStore.ts` persistence-only: retain the exact public signature `setTheme: (theme: "light" | "dark" | "system") => void`, remove the NativeWind import and imperative color-scheme side effect, and persist the requested preference unchanged. In `app/_layout.tsx`, replace the NativeWind effect with `useEffect(() => Uniwind.setTheme(theme), [theme])`.
3. In `app/extra/pengaturan.tsx`, remove the direct NativeWind call; derive `isDark` from React Native `useColorScheme()`, make the toggle persist `isDark ? "light" : "dark"`, and use `isDark` for its Switch, icon, background, label, and `<StatusBar>`. Replace the stored-theme status-bar branches in `app/Dashboard.tsx`, `app/perizinan/izin.tsx`, and `app/profile/ManageAccount.tsx` with the same resolved native color scheme so `"system"` produces the correct status-bar contrast on device changes.

## Critical files & anchors

- `package.json` — the SDK/RN runtime contract, native-only dependency removal, Reusables primitives, UniWind/Tailwind additions, and Node engine floor all converge here.
- `app.config.ts` — version/runtime compatibility, `userInterfaceStyle`, platform list, CNG plugins, Android API target, and iOS deployment target must remain mutually valid.
- `metro.config.js` — preserve the Sentry configuration and alias while making UniWind the outermost Metro wrapper.
- `global.css` — this is the one source of truth for every existing semantic visual token once `tailwind.config.js` is deleted.
- `app/_layout.tsx` — CSS entry import, `PortalHost`, persisted theme application, and Sentry-wrapped root all meet at this runtime boundary.

## Verification

1. After each SDK hop, and once again on the final lockfile, run from `C:/Users/fiz/folder_hrk/project/skanida-apps-mobile`:

   ```sh
   pnpm install --frozen-lockfile
   pnpm dlx expo-doctor@latest
   pnpm exec tsc --noEmit
   pnpm lint
   ```

   `expo-doctor` must report no SDK/config/dependency mismatch; TypeScript must resolve generated `uniwind-types.d.ts`; lint must pass without a NativeWind config parse error.
2. Start Metro once with `pnpm start -- --clear` before typechecking the final tree, which generates `uniwind-types.d.ts`. Confirm the public app config using `pnpm exec expo config --type public`: it must show `version: "1.3.0"`, `runtimeVersion.policy: "appVersion"`, `userInterfaceStyle: "automatic"`, and platforms only `ios` and `android`.
3. Prove the clean cutover by checking direct dependencies and source/configuration: `package.json` must not list `nativewind`, `react-native-css-interop`, `react-dom`, `react-native-web`, `react-native-worklets-core`, `@react-navigation/native`, `@rn-primitives/table`, or `@rn-primitives/types`; rerun the NativeWind API search over `app`, `components`, `store`, `babel.config.js`, `metro.config.js`, and `tsconfig.json` for `nativewind|cssInterop|withNativeWind|react-native-css-interop` and expect no matches.
4. Build a new Android development client rather than reusing an SDK-53 binary: with a real `.env` containing `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_BFF_API_URL`, run `pnpm android` on an Android emulator/device. On a clean app-data install, leave the persisted preference at its default `"system"`; switch the device light → dark → light and confirm Dashboard, Login/Input/Button/Icon/Card, the attendance-success popup, Settings, and every status bar track the resolved device scheme. In Settings, toggle once, restart, and confirm the explicit light/dark preference persists and controls both the visual palette and status-bar contrast.
5. On that Android development client, exercise the native paths affected by the SDK update: grant camera permission, open `CameraAttendance` and the enrollment camera, capture a photo, and submit/select a leave attachment so the `expo-file-system/legacy` checks and cleanup paths run. Use the existing approved test account and a device at the configured school location for any attendance RPC that requires it; the expected result is the existing check-in/check-out or server validation message, never a bundler/native-module error.
6. Run the existing production gate with the same prerequisites as `.github/workflows/android-apk.yml` (`EXPO_TOKEN`, `GOOGLE_SERVICES_JSON_BASE64`, Java 17, and a valid `certs/google-services.json`): `eas build --local --platform android --profile production-ci --non-interactive`. The generated APK is the release acceptance artifact. On a Mac, also run `pnpm ios` against an iOS simulator and repeat launch plus light/dark system-theme smoke; it is a compatibility check, not a release or signing gate. Do not add or run a web build.

## Assumptions & contingencies

- Android remains the only production-release gate because the current EAS profiles and GitHub workflow build Android APKs. iOS remains supported by app configuration and receives an Expo development/simulator smoke check, but this migration does not create signing credentials or an iOS release pipeline.
- Web support is intentionally removed: remove the `web` configuration block and the direct `react-dom` and `react-native-web` dependencies, then declare `platforms: ["ios", "android"]` in `app.config.ts`. Do not strip harmless upstream `Platform.select({ web: ... })` branches from freshly generated React Native Reusables wrappers; native-only application support is defined by Expo platforms and the absent web runtime packages.
- “All React Native Reusables components” means every existing registry-owned wrapper in `components/ui` is replaced with its current UniWind registry implementation: `text`, `button`, `badge`, `card`, `input`, and `icon`. App-specific `avatar`, `pop-up`, `month-year-picker`, and `attendance-calendar` retain their existing public APIs and are ported only as required to run on UniWind.
- Persisted preference `"system"` must now call `Uniwind.setTheme("system")` and follow the device color scheme. Any screen that chooses a native `StatusBar` style or branches outside CSS must derive its resolved light/dark value from React Native’s `useColorScheme()`, not from the persisted preference string.
- Bump `app.config.ts` `version` from `1.2.0-astrayao` to exactly `1.3.0` while retaining `runtimeVersion: { policy: "appVersion" }`; this forces OTA updates onto SDK-57-native builds rather than older SDK-53 binaries.
- Treat a failed Expo Doctor or TypeScript check as a blocker at its current SDK hop; rerun `expo install --fix` and resolve that hop’s incompatible source/configuration before advancing. Do not hand-upgrade an Expo-managed module to silence a later-hop error.
- The repository remains CNG-managed. Do not commit generated `android/` or `ios/` directories or hand-edit generated native projects for this work; reproduce native configuration through `app.config.ts`, plugins, and a clean prebuild/development build.
- If VisionCamera v4 fails an SDK-57 native build, first try the newest v4 patch only. If no v4 release builds against React Native 0.86, stop the release gate and scope a separate VisionCamera v5/Nitro migration rather than retaining `react-native-worklets-core` as an unsupported compatibility shim.
- UniWind’s generated declaration file may not exist until Metro starts for the first time. Generate it with the clean Metro run in Verification before treating a missing `uniwind-types.d.ts` error as a migration failure.
