# Local k3d staging

Use permanent branch `k8s-staging`, tracking `origin/k8s-staging` across the Skanida repositories when testing against the shared sandbox (`k3d-skanida-staging`, dummy data only).

## Native Staging Build (`staging` variant)

The `staging` Gradle buildType (`app/build.gradle.kts`) is preconfigured for the `k3d-skanida-staging` ingress without reading local `.env` production secrets:

```dotenv
EXPO_PUBLIC_LOGTO_ENDPOINT=http://auth.192.168.21.122.nip.io:8080
EXPO_PUBLIC_LOGTO_APP_ID=ktok16dl83bmwh85jgc97
EXPO_PUBLIC_LOGTO_REDIRECT_URI=skanida://auth/callback
EXPO_PUBLIC_LOGTO_RESOURCE=https://api.skanida-staging.test
EXPO_PUBLIC_BFF_API_URL=http://api.192.168.21.122.nip.io:8080
```

Only `debug` and `staging` enable `ALLOW_INSECURE_HTTP=true` and `android:usesCleartextTraffic="true"` (allowing both OkHttp and AppAuth `StagingAwareConnectionBuilder` to talk to `http://*.nip.io:8080` in the sandbox). Production `release` builds keep `ALLOW_INSECURE_HTTP=false` and enforce HTTPS strictly.

## Build and Install Staging APK

```sh
./gradlew :app:assembleStaging
adb install -r app/build/outputs/apk/staging/app-staging.apk
```

To install staging side-by-side without replacing a production install:

```sh
./gradlew :app:assembleStaging -PappIdSuffix=.native
adb install -r app/build/outputs/apk/staging/app-staging.apk
```

## Key Staging Behaviors & Historical QA Notes

- **Complete Dashboard Recovery (`INV-MOBILE-008`):** Reconnect (`NetworkMonitor`) and retry controls reload the full `GET /v1/mobile/dashboard` projection.
- **Native Offline Access (`INV-MOBILE-009`):** AppAuth requests PKCE, `offline_access`, and explicit `prompt=consent` so Logto issues refresh tokens.
- **Approved Leave Only (`INV-MOBILE-007`):** Only `approved` permits enter the attendance calendar; pending/rejected permits stay in Perizinan only.
- **PostgreSQL Timestamp Formatting:** `TimeSync.kt` normalizes PostgreSQL timestamp strings (space separator, fractional microseconds, and 2-digit offsets like `+07`) into `Asia/Jakarta` (WIB).
