# Mobile Architecture

Skanida Apps Mobile is a single-module native Android Gradle application (`:app`) built with Kotlin and Jetpack Compose (Material 3). Compose screens in `ui/screens/` observe `MainViewModel`; `Identity` manages Logto OIDC AppAuth sessions encrypted by `SessionStore` (Android Keystore AES-GCM); `Astra` owns bearer authentication, `X-Request-Id`, JSON/multipart transport, and `X-Astra-Contract-Version: v1` validation.

Project Astra remains the business authority. CameraX (`CameraScreen`) and platform `LocationManagerCompat` (`DeviceMedia`) provide device inputs; `NetworkMonitor` observes validated internet connectivity; `PushService` delivers native FCM push notifications registered through Astra without an Expo/React Native runtime.

**Evidence:** `app/build.gradle.kts`, `app/src/main/java/id/skanida/nativeapp/{MainActivity,MainViewModel,SkanidaApplication}.kt`, `data/`, `domain/`, `ui/`.
