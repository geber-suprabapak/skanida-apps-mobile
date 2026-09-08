# Android SIGABRT / Expo SDK 57 fix report

**Result: NOT YET SAFE FOR TESTER**

The repository-level mitigation, upstream Sentry upgrade, native-source
verification, observability audit, and tester handoff are complete. The branch
is not marked safe for physical-device testing yet because the available
machine has no Android SDK configured, no adb executable, no credentialed EAS
artifact was produced, and no physical-device/Sentry telemetry validation has
run.

The historical SIGABRT remains a suspected Sentry/Hermes sampling-profiler
teardown race, not a confirmed root cause. Confirmation requires a native stack
or tombstone that identifies the profiler path.

## Git / Rebase State

- **Starting state:** normal branch, not detached, with no active rebase or
  merge and no unmerged paths.
- **Starting branch:** release/v1.3.0-astrayao, based on the existing Expo
  migration work.
- **Starting dirty work preserved:** the pre-existing modification to
  utils/faceApiRuntime.ts and the pre-existing untracked
  docs/android-sigabrt-forensic-investigation.md were not edited, staged, or
  discarded.
- **Rebase result:** no active rebase was present, so no new migration branch
  was created and no rebase was restarted or aborted.
- **Migration base:** MIGRATION_BASE =
  c7995e760af4c006f56c5f9f5cdecbee4beba33a.
- **Ending state:** normal branch with the two isolated Sentry commits and the
  documentation commit described below. The two pre-existing user changes
  remain outside those commits.

No reset, clean, force-push, broad restore, or generated-native cleanup was
used.

## Expo Migration Validation

The repository was already at Expo SDK 57 / React Native 0.86 before the
SIGABRT changes. The checked package values are Expo ~57.0.12, React Native
0.86.2, and React 19.2.3. Expo's SDK reference identifies SDK 57 with the
React Native 0.86 line and Android compile/target SDK 36; see the
[official Expo SDK reference](https://docs.expo.dev/versions/latest/).

The migration fixed point was captured before changing Sentry. The following
baseline checks passed at MIGRATION_BASE:

- pnpm install --frozen-lockfile
- pnpm exec tsc --noEmit
- pnpm lint
- npx --yes expo-doctor@latest — 20/20 checks passed
- npx expo config --type public
- git diff --check

The same applicable checks were rerun after the Sentry mitigation and upgrade:

- frozen pnpm installation passed;
- TypeScript passed;
- lint passed with no reported errors or warnings;
- Expo Doctor passed 20/20;
- public Expo configuration resolved successfully as SDK 57;
- lockfile and whitespace checks passed.

pnpm test was attempted, but this package has no test script. No shallow test
was created just to assert a configuration value; the native race has no
faithful public JavaScript seam in this repository.

The official Sentry React Native
[8.13.0 release](https://github.com/getsentry/sentry-react-native/releases/tag/8.13.0)
was selected after the migration baseline, and the broad installed peer range
accepts Expo >=49, React >=17, and React Native >=0.65. This is compatibility
evidence, not a substitute for the physical-device and credentialed-release
validation that remains outstanding.

## Immediate Mitigation

File changed:

- app/\_layout.tsx

Exact profiling change:

```diff
-profilesSampleRate: 0.05,
+profilesSampleRate: 0,
```

The concise source comment records that profiling is intentionally disabled
during the Expo 57 rollout because of the suspected Sentry/Hermes teardown
race.

The following settings were checked and preserved:

- Sentry.init remains enabled;
- Sentry.wrap remains the root export;
- tracesSampleRate remains 0.1;
- replaysSessionSampleRate remains 0;
- replaysOnErrorSampleRate remains 0.1;
- the existing Replay and feedback integrations remain unchanged;
- Hermes and the New Architecture were not disabled;
- Vision Camera, Reanimated, Expo Updates, ABI settings, image behavior, and
  camera/business logic were not modified.

The independently revertible mitigation commit is:

```text
2ccd7d7 fix(sentry): disable profiling to mitigate Android SIGABRT
```

## Permanent Fix

### Version selection

- **Old resolved version:** @sentry/react-native 7.11.0
- **New package range:** ~8.13.0
- **New installed/resolved version:** 8.13.0
- **Installed Sentry Android SDK:** 8.43.0

The upstream
[8.10.0 release](https://github.com/getsentry/sentry-react-native/releases/tag/8.10.0)
explicitly describes the Hermes sampling-profiler React-instance teardown fix
that prevents the pthread_kill SIGABRT path. Version 8.13.0 is a later stable
8.x release with the required fix and compatible declared peer ranges. It was
chosen instead of blindly installing the current latest version so this
rollout does not introduce unnecessary newer native changes. The
[Sentry release history](https://github.com/getsentry/sentry-react-native/releases)
and the
[SDK versions table](https://github.com/getsentry/sentry-react-native/blob/8.22.0/SDK-VERSIONS.md)
were checked during selection.

The package and pnpm-lock.yaml were updated together. The Expo package version
check intentionally excludes @sentry/react-native from Expo's curated install
recommendation because the required stable Sentry 8.x line is outside the SDK
57 recommendation captured by the installed Expo metadata. The dependency is
still checked by frozen installation, TypeScript, Expo Doctor, the installed
peer range, and native-source/build inspection.

### Installed native-source proof

**FIX VERIFIED IN INSTALLED SOURCE**

The installed source was inspected rather than trusting only the version
number. In
node_modules/@sentry/react-native/android/src/main/java/io/sentry/react/RNSentryModuleImpl.java:

- invalidate() is the React Native module teardown hook;
- cleanup uses an atomic state gate so teardown and stop operations do not both
  own the profiler;
- HermesSamplingProfiler.disable() is called before the Android profiler
  reference is released;
- the surrounding comments and logic cover React instance destruction/reload
  and synchronously join the sampler cleanup path;
- both old-architecture and new-architecture wrappers delegate invalidate()
  to this implementation.

The installed JavaScript package reports version 8.13.0, with peer
dependencies compatible with the checked Expo 57 / React Native 0.86
application. The installed source therefore contains the upstream lifecycle
defense corresponding to PR #6035.

The permanent dependency/configuration commit is:

```text
3d6881c fix(sentry): upgrade SDK and enable native tombstones
```

## Tombstone / Native Observability

### Configuration added

app/\_layout.tsx now includes:

```ts
enableTombstone: true,
profilesSampleRate: 0,
```

The installed SDK exposes enableTombstone in its public options and forwards it
to Android. The native implementation enables tombstone collection through
Android's application-exit information on supported Android versions.

The Sentry Expo plugin configuration in app.config.ts also enables:

```ts
experimental_android: {
  enableAndroidGradlePlugin: true,
},
```

The installed plugin's defaults were inspected. They request ProGuard/R8
mapping upload, native symbol upload, automatic native-symbol upload, and
native source inclusion, while source context remains disabled. This keeps the
symbolication path explicit for future CNG/EAS native generation without
modifying the ignored generated android/ tree in this task.

### Symbol-upload audit

Inspected configuration:

- app.config.ts Sentry Expo plugin;
- android/sentry.properties;
- android/app/build.gradle and android/sentry.gradle;
- eas.json;
- .github/workflows/android-apk.yml;
- installed Sentry Gradle/plugin source;
- the sentry-expo-upload-sourcemaps helper.

android/sentry.properties contains the Sentry URL, organization, and project,
but no auth token. The visible Android workflow configuration contains
Expo/Google build inputs but no SENTRY_AUTH_TOKEN. The upload helper resolved
the intended URL, organization, and project, then stopped with the safe
message that SENTRY_AUTH_TOKEN must be set; no credential was printed.

External actions still required:

1. Provide SENTRY_AUTH_TOKEN through the approved EAS/CI secret mechanism with
   permission to upload releases, source maps, ProGuard/R8 mappings, and native
   debug symbols.
2. Run a credentialed release-equivalent EAS/CNG build with the Sentry plugin
   active.
3. Confirm in Sentry that JavaScript source maps, R8/ProGuard mappings, native
   ELF symbols, build IDs, and native sources were uploaded for the exact
   release.
4. Verify a test native crash/tombstone is symbolicated before relying on the
   result operationally.

No secrets were committed or exposed. Missing upload credentials do not block
the source fix, but they do block claiming production-grade symbolication.

## Expo Updates Teardown Audit

The existing update flow remains unchanged in app/extra/pengaturan.tsx:

```ts
await Updates.fetchUpdateAsync();
await Updates.reloadAsync();
```

There is still one inspected runtime replacement path, and no Sentry change
duplicates or removes it. The local machine could not perform a real OTA
reload or lifecycle run because it lacks a configured Android SDK, adb, and a
physical test device. The handoff therefore makes OTA reload a required
physical-device scenario when a real test OTA is available, including runs
with the camera closed and after visiting a camera screen.

## Automated Validation

| Check                                        | Result                         |
| -------------------------------------------- | ------------------------------ |
| pnpm install --frozen-lockfile               | PASS                           |
| pnpm exec tsc --noEmit                       | PASS                           |
| pnpm lint                                    | PASS                           |
| npx --yes expo-doctor@latest                 | PASS — 20/20                   |
| npx expo config --type public                | PASS — Expo SDK 57 config      |
| Lockfile/whitespace checks                   | PASS                           |
| pnpm test                                    | NOT AVAILABLE — no test script |
| Installed Sentry lifecycle source inspection | PASS — fix verified            |
| Android release-equivalent build             | ATTEMPTED, NOT PASSED          |
| EAS credentialed build                       | NOT EXECUTED                   |
| Physical-device validation                   | NOT EXECUTED                   |

The local Android attempt used the ignored generated project and disabled
automatic Sentry upload only for the diagnostic invocation:

```text
SENTRY_DISABLE_AUTO_UPLOAD=true
android/gradlew.bat :app:assembleRelease
  -PreactNativeArchitectures=arm64-v8a --no-daemon --console=plain
```

Gradle reached project configuration and then failed because no Android SDK
location was available:

```text
SDK location not found. Define a valid SDK location with ANDROID_HOME
or android/local.properties
```

The environment check confirmed that ANDROID_HOME, ANDROID_SDK_ROOT,
android/local.properties, and adb were unavailable. This is an environment
blocker, not evidence of an application compile failure.

**LOCAL VALIDATION PASSED for the executable repository checks listed above.**  
**EAS BUILD NOT EXECUTED — CREDENTIAL/ENVIRONMENT REQUIRED.**  
The branch remains **NOT YET SAFE FOR TESTER** until a release-equivalent
artifact is actually built and smoke-tested.

## Physical Tester Plan

Tester handoff:

[docs/testing/android-sigabrt-expo57-validation.md](testing/android-sigabrt-expo57-validation.md)

Priority devices:

- Infinix, itel, or TECNO/Transsion-family Android 12 device;
- Vivo Android 12 device;
- a second physical Android manufacturer/version for comparison.

Highest-risk flows:

- repeated cold launch;
- 20 background/foreground cycles;
- lock/unlock;
- attendance capture, upload, and camera reopening;
- rapid camera mount/unmount;
- complete and interrupted face enrollment;
- network interruption during upload;
- Expo Updates check/fetch/reload after camera use;
- 20–30 minute session and relaunch stress.

The handoff requires the tester to report the **first** failure before
continuing stress cycles and includes bounded crash-buffer/exit-info commands
for an engineer with ADB access. It does not request tokens, auth headers, or
unnecessary application data.

## Code Review

Fixed point:

```text
MIGRATION_BASE = c7995e760af4c006f56c5f9f5cdecbee4beba33a
```

Review commands:

```text
git diff c7995e760af4c006f56c5f9f5cdecbee4beba33a...HEAD
git log c7995e760af4c006f56c5f9f5cdecbee4beba33a..HEAD --oneline
```

Review axes:

- Repository standards from AGENTS.md and the existing docs/ convention:
  passed. No relevant CONTEXT.md or ADR was present to contradict.
- Task/specification compliance: passed for migration preservation, isolated
  mitigation, Sentry upgrade, tombstones, symbol-upload audit, OTA
  preservation, tester handoff, and scope boundaries.

Findings and resolutions:

- **No active rebase/merge:** no conflict resolution was needed; the existing
  migration history was preserved.
- **No duplicate initialization:** one Sentry.init and one Sentry.wrap remain.
- **Crash reporting/tracing/Replay preserved:** only profiling changed from
  0.05 to 0; tracesSampleRate and Replay values/integrations are unchanged.
- **No unrelated native/application changes:** the fixed-point diff contains
  only the Sentry initialization/plugin/package/lockfile/workspace changes.
  The ignored generated Android tree, camera code, update flow, ABI strategy,
  and business logic were not committed.
- **No secret exposure:** auth configuration was audited without printing
  values; no token was added.
- **Documentation formatting:** the handoff was formatted with the repository's
  direct Prettier binary and whitespace checks pass.
- **Testing seam:** no fake unit test was added because a JavaScript assertion
  cannot reproduce this native lifecycle race.

No serious review finding remained unresolved at the repository level. The
environment and physical-device limitations are recorded as validation
blockers, not hidden as passing results.

## Commits Created

```text
2ccd7d7 fix(sentry): disable profiling to mitigate Android SIGABRT
3d6881c fix(sentry): upgrade SDK and enable native tombstones
<documentation commit> docs(qa): add Android SIGABRT Expo 57 validation plan
```

The exact SHA of the documentation commit is available from the final git log
and is included in the completion handoff.

## Remaining Unknowns

- No native tombstone or symbolicated production stack has confirmed that the
  historical crash used Hermes sampling-profiler teardown.
- No deterministic local reproduction was available; this rare native race is
  being evaluated through installed-source inspection, build checks, physical
  devices, and Sentry telemetry.
- A credentialed EAS/CNG release artifact has not been built on this machine.
- Sentry source-map, R8/ProGuard, ELF symbol, build-ID, and native-source upload
  success still require SENTRY_AUTH_TOKEN in the approved external build
  environment.
- No physical-device run has yet exercised the camera, OTA reload, lifecycle,
  or OEM-priority scenarios.
- The current branch keeps profiling disabled. Re-enabling it belongs to a
  later controlled canary after the Expo 57 rollout and telemetry are green.

**NOT YET SAFE FOR TESTER**

Reason: the code and repository checks are ready, but the release-equivalent
Android build and physical-device validation have not passed in the available
environment.
