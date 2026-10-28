# Modules

## Expo routes and UI

**Purpose:** Navigate/authenticate students and present dashboard, attendance, leave, profile, and history screens.
**Entry points:** `app/_layout.tsx`, `app/`.

## BFF and Logto

**Purpose:** Manage OIDC session/token lifecycle and invoke Astra’s contract-versioned API.
**Entry points:** `app/auth/Login.tsx`, `utils/logto.ts`, `utils/bff.ts`, `utils/bffMobileApi.ts`.
**Login flow:** The Login route immediately opens Logto’s OIDC authorization page; identity input is collected only by Logto, not by the mobile app.

## Attendance workflow

**Purpose:** Coordinate location, precheck, capture, submission, cancellation, TTL, and success handoff.
**Entry point:** `features/attendance-workflow/attendanceWorkflow.ts`.

## Face enrollment

**Purpose:** Combine service readiness, camera permission, ten-image capture, multipart Astra submission, and temporary-file cleanup.
**Entry points:** `app/profile/enroll.tsx`, `utils/enrollment.ts`, `utils/faceApiRuntime.ts`.
**Depends on:** BFF/Logto transport and device camera/filesystem adapters.

## Shared components

**Purpose:** Render UI primitives, camera/attendance surfaces, calendar, time-sync, and notification support.
**Entry points:** `components/`, `app/attendance/`.

## Expo staging APK

**Purpose:** Build a bundled Android release APK against the dummy k3d stack, using local debug signing for sandbox QA.
**Entry points:** `scripts/build-staging-android.mjs`, `eas.json` staging profile, `app.config.ts`.
**Boundary:** The staging profile supplies public sandbox endpoints without loading local dotenv files. Native generation uses Expo57's explicit `--no-clean`; only staging allows HTTP and disables Sentry JS/native telemetry. OTA remains disabled. Production configuration keeps HTTP disabled.
**Read next:** `docs/staging-k3d.md` for build/install verification and current test limitations.

## Native Android experiment

**Purpose:** Build an independent Kotlin/Jetpack Compose Android client using the same Logto identity and Astra `v1` API. Expo source remains as the comparison baseline and is not included in this APK.
**Entry points:** `native-android/app/src/main/java/id/skanida/nativeapp/MainActivity.kt`, `native-android/app/src/main/java/id/skanida/nativeapp/MainViewModel.kt`.
**Identity/transport:** `Identity.kt`, `SessionStore.kt`, and `Astra.kt` in the same Kotlin package.
**Device boundaries:** `DeviceMedia.kt` owns location/image preparation; `CameraScreen.kt` binds CameraX; `PushService.kt` registers native FCM tokens with the existing Expo push service and Astra.
**Read next:** `native-android/README.md`; `docs/native-kotlin-experiment.md` records verification scope and outstanding parity evidence.
