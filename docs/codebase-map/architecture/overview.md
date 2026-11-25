# Mobile Architecture

Skanida Apps Mobile is a single-module native Android Gradle application (`:app`) built with Kotlin and Jetpack Compose (Material 3). `MainActivity` hosts `SkanidaTheme` and `ui/navigation/SkanidaAppHost`; single-responsibility screens in `ui/screens/` observe `@Stable` `MainViewModel`. `SkanidaApplication` warms up `Identity`, initializes Firebase, creates the notification channel, and cleans temporary captures off the main thread while supplying a shared OkHttp-backed Coil `ImageLoaderFactory` tuned for low-RAM devices.

`Identity` manages Logto OIDC AppAuth sessions encrypted by `SessionStore` (Android Keystore AES-GCM with cached `SecretKey`, cached JWT claims, and fast-path unexpired access token reuse). `Astra` owns the single shared `OkHttpClient`, bearer authentication, `X-Request-Id`, typed JSON/multipart/streaming-Base64 endpoints, and `X-Astra-Contract-Version: v1` validation.

Project Astra remains the business authority. CameraX (`CameraScreen` + `EnrollmentFlowScreens`) and platform `LocationManagerCompat` (`DeviceMedia`) provide device inputs; `NetworkMonitor` observes validated internet connectivity; `PushService` delivers native FCM push notifications registered through Astra without an Expo/React Native runtime.

**Evidence:** `app/build.gradle.kts`, `app/src/main/baseline-prof.txt`, `app/src/main/java/id/skanida/nativeapp/{MainActivity,MainViewModel,SkanidaApplication}.kt`, `ui/navigation/SkanidaAppHost.kt`, `data/`, `domain/`, `ui/`.
