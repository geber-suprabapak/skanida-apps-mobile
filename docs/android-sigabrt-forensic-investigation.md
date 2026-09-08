# Android `SIGABRT / Abort` Forensic Investigation

Repository: `skanida-apps-mobile`  
Investigation date: 2026-08-12  
Scope: Read-only forensic investigation; no code, configuration, or Git history was modified.

# Executive Summary

1. **Most likely root cause**

   The strongest repository-backed hypothesis is the **Sentry React Native Hermes SamplingProfiler teardown race**: a sampled Hermes profiler thread can outlive the React instance or JS thread during React/Expo teardown, then call `pthread_kill()` on an invalid thread and trigger `abort()`/`SIGABRT`.

   Current repository verdict for that mechanism: **`VULNERABLE`**.

   This is not yet proof that every historical Sentry event came from that path. The incident is currently under-observed because the event has no usable native stack or tombstone.

2. **Concrete repository evidence supporting it**

   - Hermes is enabled in the effective generated Android project: `android/gradle.properties:42`.
   - New Architecture is enabled: `android/gradle.properties:38`. Fabric and TurboModules therefore participate through the New Architecture path.
   - Production JavaScript enables Sentry profiling:

     ```ts
     profilesSampleRate: 0.05
     ```

     in `app/_layout.tsx:24–44`.

   - The installed package is `@sentry/react-native@7.11.0`, resolved exactly in `pnpm-lock.yaml`.
   - The installed Sentry native bridge calls `HermesSamplingProfiler.enable()` and `.disable()` from `RNSentryModuleImpl.java:1025–1093`, but the installed old- and New-Architecture module wrappers do not contain the React-instance `invalidate()` cleanup hook added by upstream PR #6035.
   - The repository has an actual React/Expo runtime teardown trigger:

     ```ts
     await Updates.fetchUpdateAsync();
     await Updates.reloadAsync();
     ```

     in `app/extra/pengaturan.tsx:161–173`.
   - The upstream issue reports the same broad native signature: `abort → pthread_kill → libhermes.so → Hermes sampling profiler`. See [Sentry issue #5441](https://github.com/getsentry/sentry-react-native/issues/5441).
   - The upstream fix specifically adds profiler cleanup during React instance teardown and was released in `@sentry/react-native@8.10.0`; see [PR #6035](https://github.com/getsentry/sentry-react-native/pull/6035) and the [8.10.0 release](https://github.com/getsentry/sentry-react-native/releases/tag/8.10.0).

3. **Evidence still missing**

   The repository cannot establish the identity of the historical crash without:

   - the raw native stack or tombstone;
   - the exact production release and build artifact;
   - the Sentry event’s `debug_meta.images`, build IDs, ABI, and native frame list;
   - confirmation that the affected artifact actually used the currently inspected Sentry/RN versions;
   - device API level, ABI, RAM, SoC, and process/lifecycle breadcrumbs;
   - evidence of whether the crash occurred during OTA reload, camera teardown, backgrounding, or another React-instance destruction event.

   At present, `SIGABRT / Abort` is a signal classification, not a root-cause stack.

4. **Single highest-value next action**

   Run one matched production canary with only:

   ```ts
   profilesSampleRate: 0
   ```

   changed from `0.05`, while leaving Session Replay, camera behavior, ABI, minification, and all other runtime settings unchanged.

   This is the smallest causal experiment for the strongest hypothesis. It is reversible and does not require changing camera or OEM behavior. The experiment must be accompanied by release, ABI, API-level, device-model, and lifecycle metadata; otherwise the very small number of affected users will make the result difficult to interpret.

   Separately, the next diagnostic-capable build should add native symbol verification and tombstone collection after moving to a Sentry SDK that supports it. Those observability changes are necessary to interpret the next occurrence, but they should not be confused with the one-variable profiler experiment.

No repository files were modified or committed during the investigation. The existing worktree change `M utils/faceApiRuntime.ts` remains untouched.

# Runtime / Dependency Matrix

The current checkout is an Expo/React Native application using pnpm. The lockfile and installed package tree were inspected rather than relying only on semver ranges in `package.json`.

| Area | Resolved/current value | Evidence and interpretation |
|---|---:|---|
| React Native | `0.86.2` | `package.json:50–52`; importer in `pnpm-lock.yaml:29–31` |
| React | `19.2.3` | `package.json:50–52` |
| Expo | `57.0.12` | `package.json:28`; `pnpm-lock.yaml:47–49` |
| Expo Updates | `57.0.13` | `package.json:46`; lockfile resolution |
| `@sentry/react-native` | `7.11.0` | `package.json:22`; exact lock resolution at `pnpm-lock.yaml:6703–6714`; installed package confirms `7.11.0` |
| Sentry Android native SDK | Declared `io.sentry:sentry-android:8.31.0` | `node_modules/@sentry/react-native/android/build.gradle:58`; also used by the generated Android module |
| Hermes | Enabled; supplied through React Native | `android/gradle.properties:42`; no standalone `hermes-engine` dependency is declared in `package.json` or `pnpm-lock.yaml` |
| Hermes exact binary revision | Not independently pinned by this repository | The current project identifies Hermes through RN `0.86.2`; the final prebuilt `libhermes.so` revision must be verified from the actual APK/AAB/build output |
| Reanimated | `4.5.1` | `package.json:55`; direct native C++/JSI dependency |
| React Native Worklets | `0.10.1` | `package.json:61`; direct native C++/JSI dependency |
| Vision Camera | Package range `^4.7.2`; installed resolution `4.7.3` | `package.json:59`; `pnpm why react-native-vision-camera`; native C++/JNI camera dependency |
| Worklets Core | `1.6.3` | Transitive through Vision Camera; separate from `react-native-worklets` |
| React Native Screens | `4.26.2` | `package.json:57`; native navigation/Fabric descriptors |
| Android Gradle Plugin | `8.12.0` | `node_modules/react-native/gradle/libs.versions.toml:9` |
| Gradle wrapper | `9.3.1` | `android/gradle/wrapper/gradle-wrapper.properties:3` |
| Kotlin | `2.1.20` | `node_modules/react-native/gradle/libs.versions.toml:32` |
| `compileSdk` | `36` | RN version catalog lines `3–5`; generated app uses root value at `android/app/build.gradle:90` |
| `targetSdk` | `36` | `android/gradle.properties:65`; `app.config.ts:64`; generated app at `android/app/build.gradle:96` |
| `minSdk` | `24` | `android/gradle.properties:64`; `app.config.ts:59`; generated app at `android/app/build.gradle:95` |
| NDK | `27.1.12297006` | `node_modules/react-native/gradle/libs.versions.toml:7`; app references root NDK value at `android/app/build.gradle:87` |
| New Architecture | Enabled | `android/gradle.properties:38` contains `newArchEnabled=true` |
| Fabric | Effectively enabled through New Architecture | There is no separate project-level `fabricEnabled` switch; current `MainActivity.kt` uses the New Architecture delegate |
| TurboModules | Effectively enabled through New Architecture | No separate project-level `turboModulesEnabled` switch was found |
| Local generated ABI list | `armeabi-v7a, arm64-v8a, x86, x86_64` | `android/gradle.properties:31` |
| Normal production EAS ABI | `arm64-v8a` | `eas.json:29` and `eas.json:43` use `-PreactNativeArchitectures=arm64-v8a` |
| ARMv7a production EAS ABI | `armeabi-v7a` | Dedicated `production-armv7a` profile at `eas.json:57` |
| Release minification | Enabled | `android/gradle.properties:66`; `android/app/build.gradle:120` |
| Release resource shrinking | Enabled | `app.config.ts:62`; generated Gradle release block at `android/app/build.gradle:119` |
| Release compression | Enabled | `android/gradle.properties:67`; `app.config.ts:61` |
| ProGuard/R8 rules | Very limited app-owned rules | `android/app/proguard-rules.pro:10–12` keeps Reanimated and React TurboModule classes; no app-specific Sentry rules were found |
| App-owned native code | None found | No app `.cpp`, `.cc`, `.c`, JNI, `CMakeLists.txt`, `Android.mk`, `jniLibs`, `.aar`, `.jar`, or prebuilt `.so` was found |
| Dependency-owned native code | Yes | Expected native objects include React Native/Hermes, Sentry NDK, Vision Camera, Reanimated, Worklets, Expo modules, Screens, and other native packages |
| Android source ownership | Generated and ignored | `.gitignore:20–21` ignores `ios` and `android`; `git ls-files android` returned no tracked Android files |

The ignored Android directory is important. The current generated tree is useful evidence of the current local prebuild, but it is not a reliable historical record of the native settings used by every production binary.

# Sentry Configuration Audit

Only one JavaScript initialization path was found:

- `app/_layout.tsx:22` imports `@sentry/react-native`.
- `app/_layout.tsx:24–40` calls `Sentry.init`.
- `app/_layout.tsx:44` wraps the root layout with `Sentry.wrap`.

No second `Sentry.init`, manual native initialization, or alternative Sentry bootstrap was found in the repository.

## Current JavaScript configuration

The effective configuration is:

```ts
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    Sentry.mobileReplayIntegration({
      maskAllText: true,
      maskAllImages: true,
    }),
    Sentry.feedbackIntegration(),
  ],
  spotlight: __DEV__,
});
```

Evidence: `app/_layout.tsx:24–40`.

### A. Profiling

Yes, Sentry profiling is enabled in production.

- `profilesSampleRate: 0.05` means approximately 5% of eligible profiling transactions are sampled.
- The value is not guarded by `__DEV__`, so it applies to release builds as well as development builds.
- No `profilesSampler` callback is configured.
- No manual `startProfiler`, `stopProfiler`, `startProfiling`, or `stopProfiling` call exists in application code.
- `profileSessionSampleRate` is not configured. That is a different Android UI/session profiling option and should not be confused with the Hermes sampling profiler activated by `profilesSampleRate`.

The installed Sentry JavaScript source confirms the relevant behavior:

- `node_modules/@sentry/react-native/dist/js/integrations/default.js:42–57` adds the Hermes profiling integration when profiling is configured.
- `node_modules/@sentry/react-native/dist/js/profiling/integration.js:68–115` starts native profiling for sampled transactions.
- `node_modules/@sentry/react-native/dist/js/profiling/integration.js:117–145` normally stops it when the associated span ends.

The important gap is that the JavaScript integration’s normal span-end cleanup is not the same as React-instance teardown cleanup. The installed native wrapper does not contain the upstream `invalidate()` hook that handles the latter.

### B. Session Replay

Session Replay is partially enabled:

- Normal session replay: disabled with `replaysSessionSampleRate: 0`.
- Replay on error: enabled at `replaysOnErrorSampleRate: 0.1`.
- `mobileReplayIntegration` is explicitly added.
- All text and images are configured to be masked.
- `spotlight: __DEV__` is development-only and is not a production crash mechanism.

The native Sentry package includes replay-related Android classes, and `RNSentryModuleImpl.java:326–335` initializes native replay when available. However:

- there is no repository evidence that Session Replay calls Hermes `pthread_kill`;
- normal replay sessions are disabled;
- the current event lacks a native stack connecting replay to the abort.

Replay is therefore a secondary candidate or risk amplifier, not the leading hypothesis.

### C. Tombstone collection

Android tombstone collection is **not enabled**.

Repository evidence:

- No `enableTombstone` property exists in `app/_layout.tsx`.
- No `enableTombstone`, `tombstone`, or equivalent option was found in the installed `@sentry/react-native@7.11.0` JavaScript options/source.
- The current Sentry Android bridge is therefore not configured to use the newer ApplicationExitInfo/tombstone path.

Sentry added the React Native `enableTombstone` option in the 8.1.0 line, for Android 12/API 31 and later. See the [Sentry React Native 8.1.0 release notes](https://github.com/getsentry/sentry-react-native/releases/tag/8.1.0).

The affected example is Android 12, which is exactly within the relevant OS range. That does not mean every Android 12 device will provide a tombstone; device/OS availability still has to be verified.

The minimum versions are therefore:

- Tombstone support: `@sentry/react-native >=8.1.0`.
- Hermes teardown race fix: `@sentry/react-native >=8.10.0`.

### D. Native crash handling

The current Sentry bridge defaults indicate native crash handling is enabled:

- `node_modules/@sentry/react-native/dist/js/sdk.js:27–44` defaults `enableNativeCrashHandling` and `enableNdk` to enabled.
- `node_modules/@sentry/react-native/dist/js/options.d.ts:17–22` and `41–46` expose those options.
- `RNSentryModuleImpl.java:370–379` removes the native crash integrations only if `enableNativeCrashHandling` is explicitly set to `false`.
- The application does not set it to `false`.

The Android bridge imports `NdkIntegration` at `RNSentryModuleImpl.java:59` and declares:

```gradle
api 'io.sentry:sentry-android:8.31.0'
```

in `node_modules/@sentry/react-native/android/build.gradle:58`.

Therefore the user-provided observation that Sentry captures the crash through Android NDK integration is consistent with the repository.

## Native symbol and build plugin configuration

The Sentry Expo plugin is present in `app.config.ts:29–40`, but only the basic organization/project configuration is supplied:

```ts
[
  "@sentry/react-native/expo",
  {
    url: "https://sentry.io/",
    project: "skanida-apps-mobile",
    organization: "geber-suprabapak",
  },
]
```

The installed plugin source shows:

- `node_modules/@sentry/react-native/plugin/build/withSentry.js:23–30` enables the Android Gradle plugin only when `experimental_android.enableAndroidGradlePlugin` is set.
- The current `app.config.ts` does not set that option.
- `android/app/build.gradle:84` applies the injected `sentry.gradle` script.
- `android/sentry.properties:1–4` contains the Sentry URL, organization, project, and a comment saying the auth token should come from `SENTRY_AUTH_TOKEN`.
- `.github/workflows/android-apk.yml` does not define or pass `SENTRY_AUTH_TOKEN`.

The repository therefore proves that the JS source-map upload path is wired into Gradle, but it does not prove that:

- ProGuard/R8 mappings were uploaded;
- native ELF symbols were uploaded;
- native source bundles were uploaded;
- the relevant EAS build actually had `SENTRY_AUTH_TOKEN`;
- the uploaded artifacts match the `release` and `dist` on the crash event.

Those points require EAS build logs and Sentry artifact inspection.

# Hermes & Profiling Investigation

## Current installed code path

The installed Sentry native implementation contains:

- `RNSentryModuleImpl.java:19` importing `HermesSamplingProfiler`;
- `RNSentryModuleImpl.java:136` holding the Android profiler;
- `RNSentryModuleImpl.java:1025–1043` starting Hermes and Android profiling;
- `RNSentryModuleImpl.java:1045–1093` stopping Hermes and Android profiling.

The old- and New-Architecture wrappers expose the profiling methods, but no React-instance invalidation cleanup was found:

- `node_modules/@sentry/react-native/android/src/oldarch/RNSentryModule.java:155–163`;
- `node_modules/@sentry/react-native/android/src/newarch/RNSentryModule.java:155–162`.

Both wrappers contain profiling method forwarding but no `invalidate()` override that disables Hermes profiling during React instance teardown.

The installed source also does not contain the defensive state/lifecycle machinery visible in the upstream fix, such as a teardown hook, `isProfiling` state guard, or cleanup on React module invalidation.

## Why the current project can reach the path

The current project satisfies all of the relevant prerequisites:

```text
Hermes enabled
    +
New Architecture enabled
    +
profilesSampleRate = 0.05
    +
@Sentry/react-native = 7.11.0
    +
no native React-instance invalidate cleanup
    +
Expo Updates can call reloadAsync()
```

The likely failure sequence is:

```text
A sampled Sentry profile starts
        ↓
Hermes creates a sampling/timer thread
        ↓
React instance is invalidated or replaced
        ↓
The sampling thread still attempts to suspend/sample the old JS thread
        ↓
pthread_kill() receives an invalid or dead pthread_t
        ↓
bionic aborts
        ↓
SIGABRT / Abort
```

This is exactly the class of mechanism described in [Sentry issue #5441](https://github.com/getsentry/sentry-react-native/issues/5441). That issue contains a native stack involving:

```text
abort
pthread_kill
libhermes.so
sampling_profiler::Sampler
```

The upstream fix in [PR #6035](https://github.com/getsentry/sentry-react-native/pull/6035) adds cleanup during React instance invalidation, including reload and bundle-swap scenarios. The fix was released in [8.10.0](https://github.com/getsentry/sentry-react-native/releases/tag/8.10.0).

## Verdict

**`VULNERABLE`**

This verdict means the current repository can hit the affected code path. It does not mean the historical Sentry issue is proven to be this race.

The exact historical attribution remains **medium confidence** until a raw stack or tombstone shows Hermes sampling-profiler frames.

# Native Dependency Inventory

The repository has no custom native module of its own. Native crash candidates come from React Native, Expo, Sentry, Vision Camera, Reanimated, Worklets, and other installed packages.

| Component | Native? | Can produce an abort? | Runs on affected flows? | Current assessment |
|---|---:|---:|---|---|
| Hermes / React Native runtime | Yes | Yes, through runtime assertions, invalid thread operations, or native faults | All app flows | High relevance because the Sentry profiler directly instruments Hermes |
| Sentry Hermes SamplingProfiler | Yes | Yes; upstream issue specifically describes `pthread_kill → abort` | Only sampled profiling sessions, currently 5% | Leading candidate |
| Sentry Android NDK | Yes | It captures native signals; it is not itself evidence that NDK caused the abort | All release builds unless disabled | Capture mechanism, not necessarily root cause |
| Expo ReactHost / Expo Updates | Yes | Can initiate React-instance replacement/teardown | OTA update and reload path | Strong trigger for the Sentry race |
| `react-native-reanimated@4.5.1` | Yes, C++/JSI/Fabric | Potentially, through native assertions/invariant failures | Theme transitions, animated UI, camera/enrollment UI | Plausible secondary candidate |
| `react-native-worklets@0.10.1` | Yes, C++/JSI | Potentially, through native invariants or lifecycle errors | Reanimated and camera-related flows | Plausible secondary candidate |
| `react-native-worklets-core@1.6.3` | Yes | Potentially through frame-processor/native invariants | Vision Camera frame processing | Plausible secondary candidate |
| `react-native-vision-camera@4.7.3` | Yes, C++/JNI/camera2 | Camera/driver/native session failures can abort depending on lower-level path | Attendance and enrollment capture flows | Plausible, but no matching abort evidence |
| React Native Screens | Yes, Fabric/native descriptors | Native assertions are possible | Navigation and screen teardown | Lower-confidence candidate |
| Gesture Handler | Yes | Possible native invariant failure | Navigation and gestures | Lower-confidence candidate |
| Expo image/file/media modules | Yes | Native decoder/media failures are possible | Image capture, file reads, uploads | Secondary candidate |
| Session Replay native integration | Yes | Possible native interaction issue, but no matching stack | On-error replay and replay-enabled sessions | Lower-confidence candidate |
| Custom app JNI/C++ | No | Not applicable | None | No app-owned native code found |
| TensorFlow Lite / OpenCV / MLKit face recognition | Not found | Not applicable from repository evidence | Face recognition is performed through backend/BFF flows | Not a repository-supported native candidate |
| WebRTC / Skia / MMKV / custom SQLite / vendor SDK | Not found | Not applicable from repository evidence | None identified | Not repository-supported |
| Custom prebuilt `.so` / `.aar` / `.jar` | Not found under app source | Not applicable as app-owned code | None | No app-owned native binaries found |

## Vision Camera

Relevant evidence:

- `node_modules/react-native-vision-camera/android/src/main/java/.../CameraViewModule.kt:44–53` loads the `VisionCamera` native library.
- `CameraViewModule.kt:56–63` manages coroutine/native lifecycle state.
- `CameraView.kt:147–149` destroys the camera session.
- `CameraView.kt:156–163` uses `CameraConfiguration.AbortThrow` to cancel stale configuration.

`AbortThrow` is a Kotlin/application-level cancellation mechanism. Its name should not be treated as proof of a C/C++ `abort()` call.

The package’s CMake configuration builds a native `VisionCamera` shared library and links Worklets Core when frame processors are enabled. This is a real native crash surface, but the repository contains no direct `abort()`, `SIGABRT`, `pthread_kill`, or fatal assertion in the application’s camera code.

## Reanimated and Worklets

Reanimated has extensive native C++/JSI code and native assertions such as `react_native_assert`. It is active in the camera/enrollment UI and uses Fabric/New Architecture.

Lifecycle evidence:

- `ReanimatedModule.kt:20–24` registers a lifecycle listener.
- `ReanimatedModule.kt:34–36` has an `onHostDestroy` path that does not itself perform the complete native teardown.
- `ReanimatedModule.kt:61–66` performs cleanup in `invalidate()`.
- `NodesManager.kt:75–84` invalidates the native proxy and removes listeners.
- Worklets performs native invalidation and scheduler deactivation in its module cleanup path.

This makes Reanimated/Worklets a credible alternative if a future tombstone points into `libreanimated.so`, `libworklets.so`, or a JSI assertion. Current evidence does not show that it is the source of this specific abort.

## Search for explicit abort mechanisms

The application source had no matches for:

```text
System.loadLibrary
externalNativeBuild
JNIEXPORT
JNI_OnLoad
abort(
SIGABRT
std::terminate
terminate()
```

The dependency search found native assertions and build-script aborts, but no application-owned direct `raise(SIGABRT)` or `abort()` implementation.

# Lifecycle / Threading Findings

## React and Android lifecycle

The generated native application uses the modern ReactHost path:

- `MainApplication.kt:17–27` implements `ReactApplication` and creates the Expo ReactHost.
- `MainApplication.kt:30–39` performs normal application initialization.
- `MainActivity.kt:14–24` has `onCreate`.
- `MainActivity.kt:36–44` uses the New Architecture/Fabric delegate.
- No custom `onDestroy`, `onPause`, `onStop`, `onTrimMemory`, or React context destruction override was found in the application.

The manifest has:

- `singleTask` launch mode;
- a broad `configChanges` list;
- orientation locked to portrait.

Evidence: `android/app/src/main/AndroidManifest.xml:24–33`.

No application code calls:

```text
recreate()
finishAffinity()
killProcess()
System.exit()
ReactInstanceManager.destroy()
ReactContext.destroy()
```

There are normal `AbortController.abort()` calls in networking/auth code. Those abort HTTP requests; they are not process-level aborts and should not be confused with `SIGABRT`.

## Expo Updates teardown trigger

This is the most important lifecycle trigger in the repository.

`app.config.ts:17–27` enables Expo Updates against:

```text
https://ota.hysilens.my.id/manifest
```

with the production channel and code signing metadata.

The manifest enables updates and checks at launch:

- `android/app/src/main/AndroidManifest.xml:24–32`.

The settings screen manually performs:

```ts
await Updates.fetchUpdateAsync();
await Updates.reloadAsync();
```

at `app/extra/pengaturan.tsx:161–173`.

This is not a theoretical path. It can replace the active JavaScript/React runtime while native modules and profiler threads exist. The upstream Sentry PR explicitly discusses reload/bundle-swap teardown as a relevant trigger.

The repository does not show an automatic foreground reload beyond the normal launch update behavior. The explicit reload is user initiated from settings, so the crash would be more likely if affected users use that flow or if an equivalent OTA reload happens elsewhere.

## Camera lifecycle

The two main camera flows are:

- Attendance: `app/attendance/CameraAttendance.tsx:657–661`, with `isActive={!isProcessing}`.
- Face enrollment: `app/profile/enroll.tsx:914–918`, with `isActive={step === "capture"}`.

The screens can navigate away with `router.back()`:

- Attendance: `CameraAttendance.tsx:559`, `573`, `679`.
- Enrollment: `enroll.tsx:688`, `705`, `732`, `935`.

Vision Camera itself has native session destruction and cancellation behavior. That creates a separate race surface, especially on:

- navigating away while camera capture is processing;
- permission transitions;
- background/foreground;
- rapid step changes in enrollment;
- OTA reload while camera is mounted.

However, a camera screen unmount does not automatically mean the entire React instance is destroyed. That distinction makes camera teardown a weaker explanation for the exact Hermes profiler race unless the event occurred during a full reload or Activity/ReactHost teardown.

# OEM / Device Correlation Analysis

The manufacturer concentration is not enough to conclude “Transsion ROM bug.”

## What the repository supports

### ABI

The standard production profiles build `arm64-v8a`:

- `eas.json:29` for `production`;
- `eas.json:43` for `production-ci`.

There is a separate ARMv7a profile:

- `eas.json:57` for `production-armv7a`.

Therefore:

- an affected Transsion device running the normal production artifact should be checked for `arm64-v8a`;
- a device running an ARMv7a artifact may follow a different native binary path;
- the manufacturer name alone does not identify the ABI.

### OS

The example Android 12 device is API 31. That matters because:

- it is eligible for the Sentry tombstone facility once a compatible SDK is installed;
- it is also compatible with the Hermes sampling-profiler race;
- there is no repository evidence that API 31 itself is the root cause.

### Native vendor code

No Transsion-specific, Infinix-specific, TECNO-specific, itel-specific, or Vivo-specific SDK was found.

No repository-owned native code calls vendor APIs. Camera and media behavior ultimately interacts with the device’s Android camera/media implementation, but there is no direct evidence that a vendor library is the aborting component.

### Low-end device characteristics

Low RAM, slower storage, MediaTek scheduling, Android Go behavior, or aggressive power management could plausibly be:

- timing amplifiers for a thread teardown race;
- memory-pressure amplifiers for image-heavy camera flows;
- triggers for different camera/media driver behavior.

They are not, from this repository, the root cause.

## Events versus users

The reported ratio of approximately 493 events to approximately 3 users is highly important.

It means the apparent OEM concentration could be caused by:

```text
a very small number of repeatedly crashing devices
        +
high retry/relaunch frequency
        +
the same model being overrepresented among those users
```

This is not equivalent to hundreds of independent devices reproducing an OEM bug.

The correct denominator is not total Sentry events. Compare:

- active devices by model;
- active device-days by model;
- sessions by model;
- crashes per 1,000 active device-days;
- crash rate by ABI/API/release;
- crash rate by camera/OTA lifecycle state.

## Classification

| Observation | Classification |
|---|---|
| Hermes profiler can call into native thread-sampling code | Potential root cause |
| `Updates.reloadAsync()` replaces the React runtime | Potential trigger |
| Low-end device scheduling exposes timing | Risk amplifier |
| Infinix/itel/TECNO appears in the event list | Correlation only |
| Three users generate hundreds of events | Sampling/denominator confounder |
| No vendor library exists in the app | Contradicts a simple OEM-SDK root-cause claim |

# Memory / OOM Analysis

The repository supports a real memory-pressure risk, but it does not currently support OOM as the primary explanation for `SIGABRT`.

## Attendance image flow

`app/attendance/CameraAttendance.tsx:47–49` defines a maximum base64 payload of approximately 5 MB.

The capture path at approximately `CameraAttendance.tsx:441–520`:

- captures a JPEG at quality 70;
- reads the file as Base64;
- logs size metadata;
- validates the payload against the 5 MB limit;
- sends it through the BFF request path;
- removes the temporary file during cleanup around `CameraAttendance.tsx:532–539`.

The networking layer serializes JSON request bodies. That can temporarily create multiple representations:

```text
JPEG/native file buffer
        +
Base64 JS string
        +
JSON request body/stringification buffers
        +
network/native buffers
```

This can be expensive on low-memory devices, even if the final payload is under the logical limit.

## Enrollment image flow

`app/profile/enroll.tsx:54–57` defines:

- ten required images;
- approximately 2 MB maximum per image;
- capture quality 60.

The capture flow at approximately `enroll.tsx:454–553` retains multiple image references and logs total-size information. Multipart upload and cleanup occur around `enroll.tsx:573–685`, with temporary-file cleanup around `enroll.tsx:681–683`.

This is a plausible native/JS memory pressure scenario, especially if:

- several high-resolution frames remain in camera/native buffers;
- Base64 or bitmap representations overlap;
- the user captures images rapidly;
- the app is backgrounded during upload;
- a low-memory device is already under pressure.

## What is absent

The repository contains no direct evidence of:

- `OutOfMemoryError`;
- `malloc` failure handling;
- native heap allocation loops;
- TensorFlow Lite tensors;
- bitmap decode explosions;
- `SIGKILL` from the low-memory killer;
- explicit `SIGSEGV`, `SIGBUS`, or allocator abort;
- native crash logs around image capture.

## Signal interpretation

Typical mechanisms differ:

| Mechanism | Usually observed as |
|---|---|
| Java heap exhaustion | `OutOfMemoryError` |
| Low-memory killer/process eviction | `SIGKILL` or process death without a normal native abort |
| Native allocator failure | May produce an allocator-specific abort or native signal, but requires a native stack |
| C/C++ assertion | `SIGABRT` |
| Invalid pthread operation | `SIGABRT`, often with `pthread_kill`/bionic frames |
| Hermes sampling-profiler race | `SIGABRT` with Hermes sampling-profiler frames |

Therefore, image memory pressure remains a risk amplifier and a secondary hypothesis, but it should not displace the Hermes hypothesis unless the next tombstone points into image decoding, camera buffers, allocator code, or an ML/native library.

# Release Build Differences

## Current variant differences

| Variant | Architecture | Native/runtime differences |
|---|---|---|
| Development | `arm64-v8a` through `eas.json:13` for debug assembly | `spotlight: __DEV__`; usually different runtime/dev tooling |
| Production | `arm64-v8a` through `eas.json:29` | Release, minified, resource-shrunk |
| Production CI | `arm64-v8a` through `eas.json:43` | Same release ABI, CI build route |
| Production ARMv7a | `armeabi-v7a` through `eas.json:57` | Different native ABI and native binaries |

The JavaScript Sentry configuration does not have a production-specific profile gate:

- `profilesSampleRate: 0.05` applies to release builds;
- Session Replay normal sessions remain off;
- on-error replay remains `0.1`;
- only Spotlight is explicitly development-only.

Release builds have:

- minification enabled: `android/gradle.properties:66`;
- resource shrinking enabled: `app.config.ts:62`;
- ABI filtering;
- C++/JNI libraries built for the selected architecture.

A release-only failure is therefore possible because release and debug differ in:

- native optimization;
- R8/ProGuard;
- code layout;
- ABI;
- timing;
- EAS packaging;
- absence of dev support tooling.

There is no repository evidence that R8 is the cause. The current ProGuard file is minimal and includes Reanimated/TurboModule keep rules.

## Historical release differences

The current checkout was upgraded recently:

- old history used Expo 53/RN 0.79.x and Sentry 6.x;
- current source uses Expo 57/RN 0.86.2 and Sentry 7.11.0;
- both the old and current Sentry versions are below the `8.10.0` profiler teardown fix.

The production event may therefore have come from:

- an older Sentry 6.x artifact;
- an intermediate Sentry/RN release;
- the current Sentry 7.11.0 artifact;
- a dedicated ARMv7a build.

The Sentry event’s release and artifact metadata are required to distinguish them.

# Observability Gaps

The current observability explains why Sentry reports only:

```text
SIGABRT
Abort
```

## Missing native forensic data

The affected event apparently lacks:

- a symbolized native stack;
- a tombstone;
- thread names and thread states;
- native build IDs;
- the exact `libhermes.so`/`libreanimated.so`/`libVisionCamera.so` frame;
- `ApplicationExitInfo` data;
- reliable release/dist/ABI correlation.

Without those, `SIGABRT` cannot distinguish:

```text
pthread_kill invalid-thread abort
        from
Reanimated assertion
        from
Vision Camera/media driver abort
        from
allocator/native-memory abort
        from
another native library
```

## Native symbol upload is not proven

Evidence in the repository shows:

- `android/app/build.gradle:84` applies Sentry’s Gradle script;
- `android/sentry.properties` supplies organization/project metadata;
- the auth token is expected from `SENTRY_AUTH_TOKEN`;
- `.github/workflows/android-apk.yml` does not contain a Sentry auth token;
- `app.config.ts` does not enable the Sentry Android Gradle plugin’s experimental Android configuration;
- no successful EAS build log was available showing native symbol upload tasks.

The repository therefore does not prove that native symbols are missing, because EAS secrets may exist outside the repository. It does prove that symbol upload is not fully auditable from source and is not explicitly configured in the checked-in workflow.

## Required next-build observability

For a compatible Sentry SDK build, enable and verify:

1. Tombstone collection on Android 12/API 31+:

   ```ts
   enableTombstone: true
   ```

   This requires upgrading from the current `7.11.0`; `8.1.0` is the minimum line with the option.

2. Native ELF symbol upload.

3. R8/ProGuard mapping upload.

4. JavaScript source-map upload.

5. Matching release and dist identifiers.

6. Verification that the Sentry artifact page contains:

   - the release;
   - the exact dist/build;
   - native debug images;
   - `libhermes.so` and other native build IDs;
   - ProGuard mapping;
   - source maps.

7. Event enrichment with:

   - ABI;
   - API level;
   - device model/manufacturer;
   - app version/build number;
   - OTA update ID/channel;
   - camera/enrollment route;
   - whether an update reload was recently requested;
   - memory class/available memory if safe to capture.

Tombstone collection improves diagnosis; it does not prevent the crash.

# Relevant Git History

| Date | Commit | Finding | Significance |
|---|---|---|---|
| 2025-06-30 | `cc4b2c6` | Introduced Sentry integration; initial config used a much higher `profilesSampleRate` and replay sampling; `Sentry.wrap` added | Earliest code-level point at which the profiler path became possible |
| 2025-03 to 2025-04 | `2d8fdcd`, `360024d` | New Architecture was enabled before or around Sentry integration | New Architecture was not a later accidental addition |
| 2025-09-30 | `34736e0` | Migrated from Expo Camera to React Native Vision Camera | Added a substantial native C++/JNI camera surface |
| 2025-10-21 | `edb3c5c6` | Added Expo Updates configuration and OTA channel/code-signing setup | Established OTA bundle/update behavior |
| 2025-10-23 | `d9d5557` | Added manual update check and `Updates.reloadAsync()` | Established an explicit React/runtime teardown trigger |
| 2026-02-10 | `f9d8417` | Reduced `profilesSampleRate` to `0.05`; disabled normal replay sessions; retained `replaysOnErrorSampleRate: 0.1` | Reduced exposure but did not remove the profiler path |
| 2026-04-18 | `465cf22`, related face API commits | Expanded face API logging/error handling and BFF-related flows | Increased diagnostic/image-flow activity but does not itself prove native abort |
| 2026-08-11 | `17549a3` | Upgraded core runtime to Expo 57/RN 0.86.2 and Sentry 7.11.0 | Current stack remains below the Sentry 8.10.0 teardown fix |
| 2026-08-11 | `bf8e51a` | Follow-up Expo splash-screen alignment | Current branch’s immediate post-upgrade state |

The history suggests:

- the Sentry/Hermes profiler path may have existed from June 2025;
- the explicit OTA reload trigger existed from October 2025;
- the camera-native alternative appeared in September 2025;
- profiling remained enabled throughout the configuration changes;
- the current Sentry upgrade did not cross the upstream fix boundary.

There is no useful Android-native Git history because the `android/` directory is ignored and has no tracked files or historical commits. Native configuration history must therefore be reconstructed from:

- `app.config.ts`;
- `eas.json`;
- package/lockfile history;
- generated native trees;
- actual EAS build artifacts.

# Ranked Root-Cause Hypotheses

| Rank | Hypothesis | Supporting evidence | Contradicting evidence | Confidence | How to prove or disprove |
|---:|---|---|---|---|---|
| 1 | Sentry/Hermes sampling-profiler teardown race | Hermes enabled; New Architecture enabled; profiling at 5%; Sentry 7.11.0 below 8.10.0; installed bridge lacks `invalidate()` cleanup; `Updates.reloadAsync()` exists; upstream issue has matching `pthread_kill → abort → libhermes.so` path | No tombstone/raw stack; affected artifact/version not yet mapped; no direct event breadcrumb proving reload or profiler activity | High that the current repository is vulnerable; medium that it caused the historical events | Turn profiling off in a matched cohort; obtain a symbolized tombstone; look for `libhermes.so`, `sampling_profiler`, `pthread_kill`, or Hermes timer-thread frames |
| 2 | Reanimated/Worklets/JSI lifecycle or invariant failure | Reanimated 4.5.1 and Worklets are native C++/JSI; New Architecture/Fabric active; native assertions exist; camera/enrollment flows use them | No direct `abort`/`SIGABRT`/`pthread_kill` evidence; installed lifecycle cleanup exists through `invalidate()`; no matching stack | Low to medium | Tombstone showing `libreanimated.so`, `libworklets.so`, `react_native_assert`, or JSI frames; disable/reduce affected animations only after evidence |
| 3 | Vision Camera/camera2/MediaCodec/GPU teardown issue | Vision Camera 4.7.3 is native C++/JNI; active in attendance/enrollment; camera session destruction and configuration cancellation occur | No application-owned abort; `AbortThrow` is cancellation, not proof of libc abort; no camera breadcrumb or native stack | Low to medium | Correlate events with camera routes and tombstones in `libVisionCamera.so`, camera2, MediaCodec, EGL, or vendor libraries |
| 4 | Image/base64/native-memory pressure | Attendance allows up to 5 MB Base64; enrollment captures ten images; JSON/multipart/native buffers can overlap; low-end devices could amplify it | No `OutOfMemoryError`, allocator failure, `SIGKILL`, or native allocation stack; signal is `SIGABRT`, not the usual Java OOM signature | Low | Capture memory class/available memory; inspect tombstone for allocator/bitmap/native heap frames; correlate crashes with image size and camera flow |
| 5 | Sentry Session Replay native interaction | Replay integration is enabled; on-error replay is 10%; native replay classes are included | Normal replay is disabled; no evidence linking replay to Hermes pthread code; no matching stack | Low | Run profiling-off/replay-unchanged first; then profile-off/replay-off if needed; compare native stacks and event breadcrumbs |
| 6 | OEM/Transsion ROM defect | Events cluster around Infinix/itel/TECNO and possibly Vivo; device scheduling/camera/vendor behavior could expose races | No vendor SDK; no OEM-specific code; only a few users generated many events; no device denominator or native stack | Low | Compare per-device exposure normalized by active device-days, ABI/API/RAM/SoC; require vendor-library frames or reproducible OEM-only behavior |

The most important distinction is:

```text
Sentry/Hermes race = repository-supported vulnerability
Sentry/Hermes race = not yet proven historical root cause
```

# Recommended Diagnostic Experiment

The actual current settings are:

```text
Hermes: ON
New Architecture: ON
Profiling: ON, 0.05
Normal Session Replay: OFF
Replay on error: ON, 0.1
Tombstone: OFF
```

## Experiment A — first and safest causal test

Deploy a small, matched production cohort with:

```text
Hermes: ON
New Architecture: ON
Profiling: OFF
Normal Session Replay: OFF
Replay on error: ON, 0.1
Tombstone: unchanged on current SDK
```

Only change:

```ts
profilesSampleRate: 0.05
```

to:

```ts
profilesSampleRate: 0
```

This tests the strongest variable without changing:

- camera code;
- OTA behavior;
- ABI;
- minification;
- Replay;
- device targeting.

### What it proves

A meaningful reduction in normalized `SIGABRT` rate among the same affected models/API/ABI would strongly support the profiler hypothesis.

### What it does not prove

If no crash is observed, that is not automatically a refutation because:

- only a few users are affected;
- the cohort may not include the same devices;
- the event is rare per active user;
- the relevant lifecycle trigger may not occur during the observation window.

Compare by:

- crashes per 1,000 active device-days;
- crashes per 1,000 sessions;
- model and ABI;
- API level;
- release/build profile;
- camera/OTA breadcrumbs.

Do not compare raw event totals only.

## Tombstone-capable diagnostic build

The current SDK cannot enable tombstones through the repository configuration. A later diagnostic build should:

1. move to a Sentry SDK that supports `enableTombstone`;
2. enable tombstone collection;
3. verify native symbol and mapping upload;
4. retain `profilesSampleRate: 0` for the first safe diagnostic rollout.

This changes the Sentry SDK and therefore is not a pure one-variable causal experiment, but it provides the native evidence needed to interpret subsequent events.

## Experiment B — only after the teardown fix is installed

After moving to a Sentry version containing the upstream fix:

```text
Profiling: ON, 0.05
Normal Replay: OFF
Replay on error: ON, 0.1
Tombstone: ON
```

This tests whether the fixed profiler path can be safely restored.

Do not run this on the current `7.11.0` build if the goal is production safety; the current version is below the known teardown fix.

## Experiment C — replay isolation

Only if Experiment A does not resolve the crash and native evidence does not identify another library:

```text
Profiling: OFF
Normal Replay: OFF
Replay on error: OFF
Tombstone: ON
```

This removes Replay as a separate variable. It should not be the first experiment because current normal Session Replay is already disabled and the profiler hypothesis is more strongly supported.

## Cohort size and duration

Because the historical events come from only a few users, a fixed percentage alone is not enough. Use:

- one control release or existing release;
- one profiler-off canary release;
- the same ABI/build profile where possible;
- comparable active-device exposure;
- enough time to include the historically affected device cohort or at least one normal release cycle.

A zero-event canary with no matching device exposure is inconclusive.

# Proposed Fixes

## Immediate observability improvements

| File/configuration | Current behavior | Proposed change | Reason | Risk | Validation |
|---|---|---|---|---|---|
| `package.json`, `pnpm-lock.yaml` | `@sentry/react-native` is `7.11.0` | Upgrade to at least `8.10.0` for the teardown fix; use a compatible later 8.x target, conservatively at least `8.11.1` if iOS compatibility is relevant | `8.10.0` contains the Hermes teardown fix; `8.1.0` is the tombstone minimum | Sentry API/native integration changes; Expo/RN compatibility must be tested | Lockfile review, Android release build, startup/capture smoke test, native source inspection, Sentry event |
| `app/_layout.tsx` | No tombstone option | After SDK upgrade, add `enableTombstone: true` | Collects Android 12+ ApplicationExitInfo/tombstone data | Additional diagnostic data; not available on every OS/device | Verify option is present in installed types/source and inspect a test native crash artifact |
| `app.config.ts` | Basic Sentry Expo plugin only | Evaluate enabling the Sentry Android Gradle plugin’s native symbol/mapping upload configuration | Current source does not prove native ELF/ProGuard uploads | Build-time auth/configuration failures | EAS logs must show mapping/native symbol tasks; Sentry artifact page must show debug images |
| EAS secrets / `.github/workflows/android-apk.yml` | No repository-visible `SENTRY_AUTH_TOKEN` | Supply the token through EAS/CI secret management, never commit it | Required for reliable upload | Secret/configuration management risk | Build log and Sentry artifact verification |
| Release metadata | EAS auto-increment exists, but source does not prove release/dist alignment | Verify exact release, dist, versionCode, ABI, and Sentry artifact IDs per build | Prevents symbol files being associated with the wrong binary | Operational bookkeeping | Compare APK/AAB manifest/versionCode, Sentry event release/dist, and debug image build IDs |

The exact upstream fix minimum is:

```text
Current @sentry/react-native: 7.11.0
Tombstone minimum: 8.1.0
Hermes teardown fix minimum: 8.10.0
Recommended starting target: compatible later 8.x, not an unreviewed latest upgrade
```

The `io.sentry:sentry-android:8.31.0` dependency currently declared inside the 7.11.0 React Native package does not itself prove that the React Native `invalidate()` fix is present. The fix is in the React Native wrapper/module lifecycle code, so changing only the Android SDK artifact would not be an adequate root-cause fix.

## Low-risk mitigations

| File/configuration | Current behavior | Proposed change | Reason | Risk | Validation |
|---|---|---|---|---|---|
| `app/_layout.tsx` | Hermes profiling samples 5% of eligible transactions | Set `profilesSampleRate: 0` temporarily or for a canary | Removes the suspected profiler thread from the crash path | Loses profiling data; does not affect app business behavior | Compare normalized native crash rate by release/model/ABI |
| `app/extra/pengaturan.tsx` | `Updates.reloadAsync()` executes immediately after fetching an update | Add a guard preventing reload while camera capture/upload is active, or restrict reload to an explicit safe app state | Reduces overlap between OTA teardown and camera/native activity | Could delay OTA application or require more state coordination | Test OTA update from settings, camera active, upload active, background/foreground |
| `CameraAttendance.tsx` | Base64 image can reach approximately 5 MB and be serialized into JSON | Consider resizing/compressing before Base64 and reducing duplicate in-memory representations | Reduces memory-pressure amplification | Could reduce face-recognition image quality; needs backend validation | Measure payload sizes, recognition success, peak memory, and native crash rate |
| `enroll.tsx` | Ten images can be captured before multipart upload | Bound retained image state and release temporary/native buffers earlier | Reduces accumulation on low-memory devices | Could complicate retry/cancel UX | Test partial enrollment, cancellation, retry, backgrounding |

These are mitigations, not proof of the root cause.

## Root-cause fixes

### Sentry/Hermes path

- Upgrade `@sentry/react-native` from `7.11.0` to a version containing the fix, minimum `8.10.0`.
- Prefer a later compatible 8.x patch after checking Expo SDK 57/RN 0.86.2 compatibility.
- Keep `profilesSampleRate: 0` until the fixed version is validated in a release build.
- Then restore profiling gradually with tombstone and symbol coverage enabled.

The upstream fix adds lifecycle cleanup during React instance invalidation. It is preferable to a local patch under `node_modules`, because the behavior involves the Sentry React Native native wrapper and both old/New-Architecture module paths.

### Reanimated/Worklets path

Do not change Reanimated or Worklets solely because they are native. If a tombstone points into those libraries:

- identify the exact native frame and version;
- compare with known upstream fixes for that exact version;
- reproduce a camera/navigation teardown on the affected ABI;
- then make the smallest version or lifecycle change required.

### Vision Camera path

If the native stack points into Vision Camera, Camera2, MediaCodec, EGL, or a vendor camera implementation:

- correlate the event with `CameraAttendance` or enrollment;
- verify whether `isActive` changes before navigation;
- test background/foreground and permission transitions;
- only then evaluate a Vision Camera upgrade or lifecycle change.

No current repository evidence justifies blindly upgrading Vision Camera or changing camera behavior as the first fix.

# Evidence / File References

## Primary repository evidence

- [`package.json`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/package.json:22>) — Sentry, Expo, React Native, Reanimated, Vision Camera, Worklets versions.
- [`pnpm-lock.yaml`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/pnpm-lock.yaml:29>) — exact resolved JavaScript package versions; Sentry package record at approximately lines `6703–6714`.
- [`app/_layout.tsx`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/app/_layout.tsx:24>) — complete Sentry initialization, profiling, replay, and `Sentry.wrap`.
- [`app.config.ts`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/app.config.ts:17>) — Expo Updates, Sentry plugin, Vision Camera plugin, Android SDK/build properties.
- [`android/gradle.properties`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/gradle.properties:31>) — ABI list, New Architecture, Hermes, SDK and release flags.
- [`android/app/build.gradle`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/app/build.gradle:84>) — Sentry Gradle script, SDK/NDK/compile configuration, release minification, Hermes dependency path.
- [`android/gradle/wrapper/gradle-wrapper.properties`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/gradle/wrapper/gradle-wrapper.properties:3>) — Gradle wrapper version.
- [`android/app/src/main/AndroidManifest.xml`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/app/src/main/AndroidManifest.xml:24>) — Expo Updates metadata and Activity lifecycle/configuration.
- [`android/sentry.properties`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/sentry.properties:1>) — Sentry organization/project and token expectation.
- [`eas.json`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/eas.json:29>) — production architecture profiles.
- [`app/extra/pengaturan.tsx`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/app/extra/pengaturan.tsx:161>) — explicit Expo update fetch/reload path.
- [`app/attendance/CameraAttendance.tsx`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/app/attendance/CameraAttendance.tsx:47>) — Base64 limit, camera capture, cleanup, and upload.
- [`app/profile/enroll.tsx`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/app/profile/enroll.tsx:54>) — ten-image enrollment flow, capture state, multipart upload, cleanup.
- [`android/app/proguard-rules.pro`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/app/proguard-rules.pro:10>) — current app-owned R8/ProGuard keep rules.
- [`android/app/src/main/java/com/hfzrk/skanidaappsmobile/MainApplication.kt`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/app/src/main/java/com/hfzrk/skanidaappsmobile/MainApplication.kt:17>) — ReactHost/application startup.
- [`android/app/src/main/java/com/hfzrk/skanidaappsmobile/MainActivity.kt`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/android/app/src/main/java/com/hfzrk/skanidaappsmobile/MainActivity.kt:14>) — Activity/New Architecture delegate.
- [`.github/workflows/android-apk.yml`](<C:/Users/fiz/folder_hrk/project/skanida-apps-mobile/.github/workflows/android-apk.yml:1>) — build workflow and visible CI secrets.

## Installed native-source evidence

These are under the installed dependency tree and are not application-owned source:

- `node_modules/@sentry/react-native/android/src/main/java/io/sentry/react/RNSentryModuleImpl.java:1025–1093`
- `node_modules/@sentry/react-native/android/src/main/java/io/sentry/react/RNSentryModuleImpl.java:370–379`
- `node_modules/@sentry/react-native/android/src/newarch/RNSentryModule.java:155–162`
- `node_modules/@sentry/react-native/android/src/oldarch/RNSentryModule.java:155–163`
- `node_modules/@sentry/react-native/dist/js/integrations/default.js:42–57`
- `node_modules/@sentry/react-native/dist/js/profiling/integration.js:68–145`
- `node_modules/@sentry/react-native/dist/js/sdk.js:27–44`
- `node_modules/react-native/gradle/libs.versions.toml:3–32`
- `node_modules/react-native/ReactAndroid/hermes-engine/build.gradle.kts:84–110`
- `node_modules/react-native-vision-camera/android/src/main/java/.../CameraViewModule.kt:44–63`
- `node_modules/react-native-vision-camera/android/src/main/java/.../CameraView.kt:147–163`
- Reanimated Android/Kotlin and C++ source under `node_modules/react-native-reanimated/android` and `node_modules/react-native-reanimated/Common/cpp`
- Worklets Android/Kotlin and C++ source under `node_modules/react-native-worklets/android` and `node_modules/react-native-worklets/Common/cpp`

## Upstream comparison evidence

- [Sentry issue #5441](https://github.com/getsentry/sentry-react-native/issues/5441) — Hermes sampling-profiler `pthread_kill`/`abort` crash signature.
- [Sentry PR #6035](https://github.com/getsentry/sentry-react-native/pull/6035) — React-instance teardown cleanup and reload/bundle-swap relevance.
- [Sentry React Native 8.10.0 release](https://github.com/getsentry/sentry-react-native/releases/tag/8.10.0) — profiler teardown fix release.
- [Sentry React Native 8.1.0 release](https://github.com/getsentry/sentry-react-native/releases/tag/8.1.0) — tombstone collection support and Android 12/API 31 boundary.

# Unknowns Requiring Runtime Data

The following cannot be resolved from this repository alone:

1. The exact native stack for the affected event.
2. Whether the stack contains:
   - `libhermes.so`;
   - `sampling_profiler`;
   - `pthread_kill`;
   - `libreanimated.so`;
   - `libworklets.so`;
   - `libVisionCamera.so`;
   - Camera2/MediaCodec/EGL/vendor frames;
   - allocator/bitmap/native-memory frames.
3. Whether the affected production artifact used:
   - Sentry 6.x;
   - Sentry 7.11.0;
   - another intermediate version;
   - the current Expo 57/RN 0.86.2 stack.
4. Exact release, dist, versionCode, and EAS build profile for each event.
5. Whether affected devices used `arm64-v8a` or `armeabi-v7a`.
6. The Android API-level distribution across all affected events.
7. Device RAM, memory class, SoC, CPU architecture, and available memory at crash time.
8. Whether the crash occurs during:
   - OTA reload;
   - app launch after OTA update;
   - camera capture;
   - camera navigation/unmount;
   - enrollment upload;
   - background/foreground;
   - permission changes;
   - logout or auth reset.
9. Whether the sampled Sentry profile was active for the affected event.
10. Whether Session Replay was active or had recently started.
11. Whether Sentry’s native symbols, ProGuard mappings, and source maps were uploaded for the exact artifact.
12. Whether Sentry’s `release` and `dist` identifiers match the uploaded build artifacts.
13. Whether the three reported users correspond to three physical devices repeatedly crashing.
14. Whether any affected model is genuinely ARMv7a or all are ARM64.
15. Whether the production binary contains the expected versions/build IDs of:
   - `libhermes.so`;
   - `libreactnative*.so`;
   - `libVisionCamera.so`;
   - `libreanimated.so`;
   - `libworklets.so`;
   - Sentry’s native libraries.
16. Whether the current event was captured before or after the August 11 runtime upgrade.

The repository evidence is sufficient to justify treating the Sentry/Hermes race as the primary investigation target and to stop attributing the issue to OEM behavior without further proof. It is not sufficient to call that race the confirmed historical root cause until the next native stack or tombstone is collected.
