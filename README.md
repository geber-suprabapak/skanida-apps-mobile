# Skanida Apps Mobile

Native Android (Kotlin + Jetpack Compose) client for Skanida student workflows: Logto OIDC authentication, dashboard & WIB time sync, two-phase face attendance, 10-photo face enrollment, monthly calendar history, leave requests, and native FCM push notifications.

## Runtime Architecture

- **Identity & RBAC:** Logto (`net.openid:appauth` + PKCE + `offline_access` + `prompt=consent`), persisted encrypted with AES-GCM via Android Keystore (`SessionStore`), with cached JWT claims and fast-path token reuse.
- **Backend-for-Frontend (BFF):** Project Astra `/v1/mobile/*` and `/v1/auth/student/*` via typed methods on `Astra.kt` (`Authorization: Bearer`, `X-Request-Id`, `X-Astra-Contract-Version: v1`) and streaming Base64 attendance upload.
- **UI & Design System:** Jetpack Compose + Material 3 following [`DESIGN.md`](DESIGN.md) ("The Indigo-Cobalt Digital Student Pass"), with isolated 1 Hz clock updates, `drawWithCache` overlays, and `@Immutable` models for smooth performance on older low-RAM Android devices (API 24+).
- **Camera, Media & Startup:** CameraX (`camera-camera2`, `camera-lifecycle`, `camera-view`) with bounded 1280px capture resolution, RGB_565 image downsampling, shared OkHttp/Coil pools (`SkanidaApplication`), and an ART Baseline Profile (`app/src/main/baseline-prof.txt` + `profileinstaller`).
- **Push Notifications:** Native `FirebaseMessagingService` initialized off the main thread and registering FCM tokens to Astra via Expo push HTTP without any Expo/RN/Node runtime.

## BFF-Covered Flows

- Dashboard: `GET /v1/mobile/dashboard`
- Server health: `GET /v1/mobile/health`
- Attendance precheck: `POST /v1/mobile/attendance/precheck`
- Attendance submit: `POST /v1/mobile/attendance/submit`
- Attendance history: `GET /v1/mobile/attendance`
- Face enrollment status: `GET /v1/mobile/face/enrollment/status`
- Face enrollment upload: `POST /v1/mobile/face/enrollment`
- Permits: `GET /v1/mobile/permits`, `POST /v1/mobile/permits`
- Profile & avatar: `GET /v1/mobile/profile`, `PATCH /v1/mobile/profile/avatar`
- Password: `PATCH /v1/mobile/profile/password`
- Push token: `GET /v1/mobile/notifications/token`, `PATCH /v1/mobile/notifications/token`
- Activation & recovery: `POST /v1/auth/student/signup`, `POST /v1/auth/student/reset-password`

## Environment & Prerequisites

- JDK 17
- Android SDK 36 (`compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`)
- Set `ANDROID_HOME` or provide `local.properties` with `sdk.dir=/path/to/Android/sdk`.
- Copy `.env.example` to `.env` for local live/debug endpoints (`EXPO_PUBLIC_LOGTO_ENDPOINT`, `EXPO_PUBLIC_LOGTO_APP_ID`, `EXPO_PUBLIC_LOGTO_REDIRECT_URI`, `EXPO_PUBLIC_BFF_API_URL`, `EXPO_PUBLIC_LOGTO_RESOURCE`).
- For push notifications, place `google-services.json` in `app/google-services.json` or `certs/google-services.json`.

## Build Variants

- `debug`: Debuggable APK allowing local HTTP endpoints.
- `staging`: R8-minified APK configured for the `k3d-skanida-staging` sandbox (`http://api.192.168.21.122.nip.io:8080`, `http://auth.192.168.21.122.nip.io:8080`), signed with debug keys.
- `release`: R8-minified, resource-shrunk production APK (`https://` only, `id` + `en` locales, ART Baseline Profile). Requires `signing.properties` for release signing.
- Pass `-PappIdSuffix=.native` to install any variant side-by-side without overwriting `com.hfzrk.skanidaappsmobile`.

## Commands

```sh
# Format check and static analysis
./gradlew spotlessCheck detekt

# Run unit tests
./gradlew :app:testDebugUnitTest

# Run Android lint on release variant
./gradlew :app:lintRelease

# Build APKs (add -PenableComposeCompilerReports=true for Compose stability metrics)
./gradlew :app:assembleDebug
./gradlew :app:assembleStaging
./gradlew :app:assembleRelease
```
