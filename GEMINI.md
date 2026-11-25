# Gemini Project Context: skanida-apps-mobile

## Project Overview

Skanida Apps Mobile is a native Android application written in **Kotlin + Jetpack Compose** (Material 3) for SMK Negeri 2 Magelang student attendance and leave workflows. It communicates exclusively with Project Astra (`/v1/mobile/*`, `/v1/auth/student/*`) using Logto OIDC identity via AppAuth.

### Key Technologies

- **Language & Build:** Kotlin 2.2, Gradle 8.13 (`:app`), JDK 17, Android SDK 36 (`minSdk = 24`, `targetSdk = 36`), Spotless (ktlint 1.5.0), Detekt 1.23.8
- **UI:** Jetpack Compose + Material 3 following `DESIGN.md` ("The Indigo-Cobalt Digital Student Pass")
- **Auth & Persistence:** `net.openid:appauth` (PKCE + `offline_access` + `prompt=consent`), encrypted `SessionStore` via Android Keystore AES-GCM with cached key & fast-path token check
- **Networking & Media:** Shared OkHttp 4 client (`Astra.httpClient`) reused by Coil 2 (`ImageLoaderFactory`, RGB_565, bounded caches) and `PushController`, strict `X-Astra-Contract-Version: v1` enforcement, streaming Base64 attendance upload
- **Camera & Startup:** CameraX (`camera-camera2`, `camera-lifecycle`, `camera-view`) with bounded 1280px capture resolution, ExifInterface, `androidx.profileinstaller` + `app/src/main/baseline-prof.txt`
- **Push:** Firebase Cloud Messaging (`PushService.kt`) initialized off the main thread and registering native FCM tokens via Expo push HTTP into Astra

## Package Structure (`app/src/main/java/id/skanida/nativeapp/`)

- `SkanidaApplication.kt` — Application-scoped `Identity`, `Astra`, `PushController`, `NetworkMonitor`, Coil `ImageLoaderFactory`, and off-main-thread startup warm-up
- `MainActivity.kt` — Edge-to-edge activity entry point hosting `SkanidaTheme` and `SkanidaAppHost`
- `MainViewModel.kt` — `@Stable` app state, parallel BFF hydration, reconnect observer, and workflow orchestration
- `ui/navigation/SkanidaAppHost.kt` — Runtime permission launchers, adaptive `NavigationBar`/`NavigationRail` scaffold, top bar, FAB, back handling, and confirmation dialogs
- `data/model/AstraModels.kt` — `@Immutable` Kotlin models and `JSONObject` mappers for Astra `v1`
- `data/api/Astra.kt` — Shared BFF transport, typed endpoints, contract-version validation, streaming Base64 JSON upload, multipart uploads, error normalization
- `data/auth/Identity.kt`, `SessionStore.kt` — Logto OIDC lifecycle, cached JWT claim parser, fast-path access token reuse, Keystore AES-GCM session storage
- `data/device/DeviceMedia.kt`, `NetworkMonitor.kt`, `PushService.kt` — Location/mock detection, RGB_565 image normalization, connectivity, FCM push
- `domain/workflow/TimeSync.kt`, `AttendanceHistory.kt`, `AttendancePresentation.kt`, `AttendanceWorkflow.kt`, `InputValidation.kt`, `MotivationalQuotes.kt` — WIB timezone formatting, calendar/permit merge (`INV-MOBILE-007`), pure input validation, immutable two-phase attendance tracker (`INV-MOBILE-002`..`004`)
- `ui/theme/Theme.kt` — `DESIGN.md` tokens (`#1B5BFF` Cobalt, Indigo-Cobalt Pass, cached `ColorScheme` instances, WCAG AA pass badges, light/dark modes)
- `ui/components/` — `DesignComponents.kt` (`drawWithCache` overlays, shared pickers/rows/dialogs), `AttendanceSuccessDialog.kt` (draw-phase confetti, Reduce Motion, low-RAM particle scaling)
- `ui/screens/` — `WelcomeAndAuthScreens.kt`, `HomeScreen.kt` (isolated 1 Hz `LiveWibClock`), `AbsenceReportScreen.kt`, `CameraScreen.kt`, `EnrollmentFlowScreens.kt`, `HistoryScreen.kt`, `PermitsScreen.kt`, `LeaveScreen.kt`, `SettingsScreen.kt`, `AccountScreen.kt`, `NotificationsScreen.kt`

## Verification Commands

```sh
./gradlew spotlessCheck detekt
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
- Keep Keystore, Firebase, file I/O, and image processing off the main thread, and keep 1 Hz UI tickers isolated to leaf composables.
