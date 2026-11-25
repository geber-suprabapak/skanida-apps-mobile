# Modules

## Compose UI & Navigation Host

**Purpose:** Render "The Digital Student Pass" UI (`DESIGN.md`) and navigate students across authentication, dashboard, attendance precheck/camera, monthly calendar history, permits, profile, and settings.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/MainActivity.kt`, `app/src/main/java/id/skanida/nativeapp/ui/screens/`, `app/src/main/java/id/skanida/nativeapp/ui/components/`.
**Dashboard recovery:** Reconnect (`NetworkMonitor`) and retry controls reload the complete Astra dashboard projection, keeping attendance, schedule, face state, and primary action consistent (`INV-MOBILE-008`).

## BFF and Logto Identity

**Purpose:** Manage OIDC session/token lifecycle (`AppAuth`, Keystore AES-GCM `SessionStore`) and invoke Astra’s contract-versioned API.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/data/auth/Identity.kt`, `SessionStore.kt`, `app/src/main/java/id/skanida/nativeapp/data/api/Astra.kt`, `data/model/AstraModels.kt`.
**Offline access:** Native authorization uses PKCE and explicit `prompt=consent` with `offline_access`; `Identity.kt` owns token refresh and permanent vs. transient failure handling (`INV-MOBILE-006`, `INV-MOBILE-009`).

## Attendance Workflow & Time Sync

**Purpose:** Coordinate GPS/mock-location verification, precheck screen (`AbsenceReportScreen`), attempt TTL/ownership tracking, base64 capture submission, WIB time sync, and monthly calendar merging (`INV-MOBILE-007`).
**Entry points:** `app/src/main/java/id/skanida/nativeapp/domain/workflow/AttendanceWorkflow.kt`, `AttendanceHistory.kt`, `TimeSync.kt`, `MotivationalQuotes.kt`.

## Device Media, Connectivity & Push

**Purpose:** Bind CameraX for attendance/enrollment/avatar/leave attachments, enforce location/mock-location checks, observe network connectivity, and register native FCM tokens with Astra via Expo push HTTP without any Expo SDK/runtime.
**Entry points:** `app/src/main/java/id/skanida/nativeapp/data/device/DeviceMedia.kt`, `NetworkMonitor.kt`, `PushService.kt`.

## Build Variants (`debug`, `staging`, `release`)

**Purpose:** Build Android APKs from the root Gradle project (`app/build.gradle.kts`).
**Boundary:** `release` disables cleartext HTTP (`ALLOW_INSECURE_HTTP=false`). `staging` permits HTTP to the local `k3d-skanida-staging` ingress (`http://*.nip.io:8080`) and signs with debug keys. `-PappIdSuffix=.native` enables side-by-side test installation.
**Read next:** `docs/staging-k3d.md` for staging verification details.
