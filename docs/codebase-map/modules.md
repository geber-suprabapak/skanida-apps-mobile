# Modules

## Compose UI & Navigation Host

**Purpose:** Render "The Indigo-Cobalt Digital Student Pass" UI (`DESIGN.md`) and navigate students across authentication, dashboard, attendance precheck/camera, monthly calendar history, permits, leave form, account, notifications, and settings.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/MainActivity.kt`, `ui/navigation/SkanidaAppHost.kt`, `ui/components/` (`DesignComponents.kt`, `AttendanceSuccessDialog.kt`), and single-responsibility screens in `ui/screens/` (`WelcomeAndAuthScreens.kt`, `HomeScreen.kt`, `AbsenceReportScreen.kt`, `CameraScreen.kt`, `EnrollmentFlowScreens.kt`, `HistoryScreen.kt`, `PermitsScreen.kt`, `LeaveScreen.kt`, `SettingsScreen.kt`, `AccountScreen.kt`, `NotificationsScreen.kt`).
**Dashboard recovery:** Reconnect (`NetworkMonitor`) and retry controls reload the complete Astra dashboard projection, keeping attendance, schedule, face state, and primary action consistent (`INV-MOBILE-008`).

## BFF and Logto Identity

**Purpose:** Manage OIDC session/token lifecycle (`AppAuth`, Keystore AES-GCM `SessionStore`) and invoke Astra’s contract-versioned API through typed suspend methods and streaming Base64 uploads.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/data/auth/Identity.kt`, `SessionStore.kt`, `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt`, `data/model/AstraModels.kt`.
**Offline access:** Native authorization uses PKCE and explicit `prompt=consent` with `offline_access`; `Identity.kt` owns fast-path token reuse, cached JWT claims, and permanent vs. transient refresh failure handling (`INV-MOBILE-006`, `INV-MOBILE-009`).

## Attendance Workflow, Validation & Time Sync

**Purpose:** Coordinate GPS/mock-location verification, precheck dialog (`AbsenceReportScreen.kt`), immutable attempt TTL/ownership tracking, pure form/quota validation, WIB time sync, and monthly calendar merging (`INV-MOBILE-007`).
**Entry points:** `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceWorkflow.kt`, `AttendanceHistory.kt`, `AttendancePresentation.kt`, `InputValidation.kt`, `TimeSync.kt`, `MotivationalQuotes.kt`.

## Device Media, Connectivity & Push

**Purpose:** Bind CameraX with bounded 1280px capture resolution for attendance/enrollment/avatar/leave attachments, downsample images with `RGB_565`, enforce location/mock-location checks, observe network connectivity, and register native FCM tokens with Astra via Expo push HTTP without any Expo SDK/runtime.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/data/device/DeviceMedia.kt`, `NetworkMonitor.kt`, `PushService.kt`.

## Build Variants, Startup & Baseline Profile (`debug`, `staging`, `release`)

**Purpose:** Build lean Android APKs from the root Gradle project (`app/build.gradle.kts`) with `id`/`en` resource filtering, ART Baseline Profiles (`app/src/main/baseline-prof.txt` + `profileinstaller`), and off-main-thread warm-up in `SkanidaApplication.kt`.
**Boundary:** `release` disables cleartext HTTP (`ALLOW_INSECURE_HTTP=false`). `staging` permits HTTP to the local `k3d-skanida-staging` ingress (`http://*.nip.io:8080`) and signs with debug keys. `-PappIdSuffix=.native` enables side-by-side test installation.
**Read next:** `docs/staging-k3d.md` for staging verification details.
