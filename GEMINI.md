# Gemini Project Context: skanida-apps-mobile

## Project Overview

Skanida Apps Mobile is a native Android application written in **Kotlin + Jetpack Compose** (Material 3) for SMK Negeri 2 Magelang student attendance and leave workflows. It communicates exclusively with Project Astra (`/v1/mobile/*`, `/v1/auth/student/*`) using Logto OIDC identity via AppAuth.

### Key Technologies

- **Language & Build:** Kotlin 2.2, Gradle 8.13 (`:app`), JDK 17, Android SDK 36 (`minSdk = 24`, `targetSdk = 36`)
- **UI:** Jetpack Compose + Material 3 following `DESIGN.md` ("The Digital Student Pass")
- **Auth & Persistence:** `net.openid:appauth` (PKCE + `offline_access` + `prompt=consent`), encrypted `SessionStore` via Android Keystore AES-GCM
- **Networking:** OkHttp 4 + `org.json` with strict `X-Astra-Contract-Version: v1` enforcement
- **Camera & Media:** CameraX (`camera-camera2`, `camera-lifecycle`, `camera-view`), ExifInterface, Coil (`coil-compose`)
- **Push:** Firebase Cloud Messaging (`PushService.kt`) registering native FCM tokens via Expo push HTTP into Astra

## Package Structure (`app/src/main/java/id/skanida/nativeapp/`)

- `MainActivity.kt` — Compose host, navigation scaffold, runtime permissions, back handling, dialogs
- `MainViewModel.kt` — App state, network reconnect observer, and workflow orchestration
- `SkanidaApplication.kt` — Application-scoped `Identity`, `Astra`, `PushController`, `NetworkMonitor`
- `data/model/AstraModels.kt` — Typed Kotlin models and `JSONObject` mappers for Astra `v1`
- `data/api/Astra.kt` — Shared BFF transport, contract-version validation, multipart uploads, error normalization
- `data/auth/Identity.kt`, `SessionStore.kt` — Logto OIDC lifecycle and Keystore AES-GCM session storage
- `data/device/DeviceMedia.kt`, `NetworkMonitor.kt`, `PushService.kt` — Location/mock detection, image normalization, connectivity, FCM push
- `domain/workflow/TimeSync.kt`, `AttendanceHistory.kt`, `AttendanceWorkflow.kt`, `MotivationalQuotes.kt` — WIB timezone formatting, calendar/permit merge (`INV-MOBILE-007`), two-phase attendance attempt tracker (`INV-MOBILE-002`..`004`)
- `ui/theme/Theme.kt` — `DESIGN.md` tokens (Electric Blue `#0066FF`, Midnight Slate `#0F172A`, semantic colors, light/dark modes)
- `ui/components/` — `DesignComponents.kt`, `AttendanceSuccessDialog.kt`
- `ui/screens/` — `WelcomeAndAuthScreens.kt`, `HomeScreen.kt`, `AbsenceReportScreen.kt`, `CameraScreen.kt`, `HistoryScreen.kt`, `PermitsAndLeaveScreens.kt`, `SettingsAndAccountScreens.kt`

## Verification Commands

```sh
./gradlew :app:testDebugUnitTest
./gradlew :app:lintRelease
./gradlew :app:assembleDebug :app:assembleStaging :app:assembleRelease
```

## Critical Invariants

- Never commit `signing.properties`, `google-services.json`, `.env`, or keystores.
- All business state comes from Astra `/v1/mobile/*` with `X-Astra-Contract-Version: v1`; never call Supabase directly.
- Display all times in `Asia/Jakarta` (WIB); format dates in Indonesian (`id-ID`) locale.
- Keep `ALLOW_INSECURE_HTTP` disabled (`false`) in `release`; allow HTTP only in `debug` and `staging`.
- Only `approved` leave requests enter the attendance calendar (`INV-MOBILE-007`); pending/rejected permits stay in Perizinan only.
